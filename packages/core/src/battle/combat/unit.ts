import { cast, type SkillContext, type SkillParams } from "./skill.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";
import { BuffManager } from "./buff.js";

export type Faction = "Ally" | "Enemy";
export const Faction = {
  opponent: { Ally: "Enemy", Enemy: "Ally" } satisfies Record<Faction, Faction>,
  getOpponent(faction: Faction): Faction {
    return Faction.opponent[faction];
  },
};

export type UnitSkill = {
  skill: string;
  uuid: string;
  params: SkillParams;
  /** Progress per frame for onUpdate, per damage point for onDamage*,
   * otherwise guaranteed casts plus fractional trigger chance.
   * Omit to cast once per event, regardless of damage amount. */
  castRate?: number;
};

export type UnitSkills = {
  onUpdate?: UnitSkill[];
  onHitDealt?: UnitSkill[];
  onHitReceived?: UnitSkill[];
  onDamageDealt?: UnitSkill[];
  onDamageReceived?: UnitSkill[];
  onHeal?: UnitSkill[];
  onKill?: UnitSkill[];
  onDeath?: UnitSkill[];
};

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  skills: UnitSkills = {};
  buffs: BuffManager = new BuffManager();
  protected skillProgress = new Map<string, number>();
  maxHp: number = 1;
  hp: number = 1;
  lastHitUnit: Unit | null = null;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ attributes: { maxHp: 1 }, tags: [] }),
  );
  status: Status.Status = Status.createByConfig({
    attributes: { maxHp: 1 },
    tags: [],
  });
  skillContexts: Record<string, SkillContext> = {};

  private accumulateSkills(
    ctx: BattleContext,
    type: "onUpdate" | "onDamageDealt" | "onDamageReceived",
    amount: number,
  ): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(
        "progress amount must be a finite non-negative number",
      );
    }
    for (const { uuid, castRate } of this.skills[type] ?? []) {
      if (castRate === undefined) {
        cast(this, this.skillContexts[uuid]!);
        continue;
      }
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      const progress = (this.skillProgress.get(uuid) ?? 0) + castRate * amount;
      if (!Number.isFinite(progress)) {
        throw new RangeError("skill progress must be finite");
      }
      this.skillProgress.set(uuid, progress);
      // Read back progress after each cast, since casting can trigger more damage.
      while ((this.skillProgress.get(uuid) ?? 0) >= 1 - 1e-6) {
        this.skillProgress.set(
          uuid,
          Math.max(0, (this.skillProgress.get(uuid) ?? 0) - 1),
        );
        cast(this, this.skillContexts[uuid]!);
      }
    }
  }

  protected updateSkills(ctx: BattleContext): void {
    this.accumulateSkills(ctx, "onUpdate", 1);
  }

  protected triggerSkills(
    ctx: BattleContext,
    type: Exclude<keyof UnitSkills, "onUpdate">,
  ): void {
    for (const { uuid, castRate } of this.skills[type] ?? []) {
      if (castRate === undefined) {
        cast(this, this.skillContexts[uuid]!);
        continue;
      }
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      let casts = Math.floor(castRate);
      const chance = castRate - casts;
      if (chance > 0 && ctx.rng.rand() < chance) casts += 1;
      for (let index = 0; index < casts; index++) {
        cast(this, this.skillContexts[uuid]!);
      }
    }
  }

  abstract calcBaseStatus(ctx: BattleContext): Status.Status;
  abstract onMove(ctx: BattleContext): void;
  onUpdate(ctx: BattleContext): void {
    this.updateSkills(ctx);
    for (const callback of [...(this.status.triggers.onUpdate ?? [])]) {
      callback(this, ctx);
    }
  }
  onDeath(ctx: BattleContext): void {
    this.triggerSkills(ctx, "onDeath");
    for (const callback of [...(this.status.triggers.onDeath ?? [])]) {
      callback(this, ctx);
    }
  }
  onHitDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.triggerSkills(ctx, "onHitDealt");
    for (const callback of [...(this.status.triggers.onHitDealt ?? [])]) {
      callback(this, ctx, dst, amount);
    }
  }
  onHitReceived(ctx: BattleContext, src: Unit, amount: number): void {
    this.triggerSkills(ctx, "onHitReceived");
    for (const callback of [...(this.status.triggers.onHitReceived ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onDamageDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.accumulateSkills(ctx, "onDamageDealt", amount);
    for (const callback of [...(this.status.triggers.onDamageDealt ?? [])]) {
      callback(this, ctx, dst, amount);
    }
  }
  onDamageReceived(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.accumulateSkills(ctx, "onDamageReceived", amount);
    for (const callback of [...(this.status.triggers.onDamageReceived ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onHeal(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.triggerSkills(ctx, "onHeal");
    for (const callback of [...(this.status.triggers.onHeal ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onKill(ctx: BattleContext, dst: Unit): void {
    this.triggerSkills(ctx, "onKill");
    for (const callback of [...(this.status.triggers.onKill ?? [])]) {
      callback(this, ctx, dst);
    }
  }
}
