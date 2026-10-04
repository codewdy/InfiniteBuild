import { cast, type SkillParams } from "./skill.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";

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
  /** Progress per update, or guaranteed casts plus fractional trigger chance. */
  castRate: number;
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
  protected skillProgress = new Map<string, number>();
  maxHp: number = 1;
  hp: number = 1;
  lastHitUnit: Unit | null = null;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ attributes: { maxHp: 1 }, tags: [] }),
  );
  status: Status.Status = Status.createByConfig({ attributes: { maxHp: 1 }, tags: [] });

  protected updateSkills(ctx: BattleContext): void {
    for (const { uuid, skill, castRate, params } of this.skills.onUpdate ??
      []) {
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      let progress = (this.skillProgress.get(uuid) ?? 0) + castRate;
      this.skillProgress.set(uuid, progress);
      while (progress >= 1) {
        progress -= 1;
        this.skillProgress.set(uuid, progress);
        cast(ctx, this, skill, params);
      }
    }
  }

  protected triggerSkills(
    ctx: BattleContext,
    type: Exclude<keyof UnitSkills, "onUpdate">,
  ): void {
    for (const { skill, castRate, params } of this.skills[type] ?? []) {
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      let casts = Math.floor(castRate);
      const chance = castRate - casts;
      if (chance > 0 && ctx.rng.rand() < chance) casts += 1;
      for (let index = 0; index < casts; index++) {
        cast(ctx, this, skill, params);
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
    this.triggerSkills(ctx, "onDamageDealt");
    for (const callback of [...(this.status.triggers.onDamageDealt ?? [])]) {
      callback(this, ctx, dst, amount);
    }
  }
  onDamageReceived(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.triggerSkills(ctx, "onDamageReceived");
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
