import { SkillTrigger, type UnitSkills } from "./skill-trigger.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";
import { BuffManager, type BuffParams } from "./buff.js";

export type Faction = "Ally" | "Enemy";
export const Faction = {
  opponent: { Ally: "Enemy", Enemy: "Ally" } satisfies Record<Faction, Faction>,
  getOpponent(faction: Faction): Faction {
    return Faction.opponent[faction];
  },
};

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  skills: UnitSkills = {};
  skillTrigger = new SkillTrigger();
  buffs: BuffManager = new BuffManager();
  maxHp: number = 1;
  hp: number = 1;
  lastHitUnit: Unit | null = null;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ attributes: { maxHp: 1 }, tags: [] }),
  );
  status: Status = Status.createByConfig({
    attributes: { maxHp: 1 },
    tags: [],
  });

  applyBuff(
    buff: string,
    level: number,
    duration: number,
    params: BuffParams = {},
  ): void {
    this.buffs.stack(buff, level, duration, params);
  }

  abstract calcBaseStatus(ctx: BattleContext): Status;
  abstract onMove(ctx: BattleContext): void;
  onUpdate(ctx: BattleContext): void {
    this.skillTrigger.trigger(ctx, this, "onUpdate");
    for (const callback of [...(this.status.triggers.onUpdate ?? [])]) {
      callback(this, ctx);
    }
  }
  onDeath(ctx: BattleContext): void {
    this.skillTrigger.trigger(ctx, this, "onDeath");
    for (const callback of [...(this.status.triggers.onDeath ?? [])]) {
      callback(this, ctx);
    }
  }
  onHitDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.skillTrigger.trigger(ctx, this, "onHitDealt");
    for (const callback of [...(this.status.triggers.onHitDealt ?? [])]) {
      callback(this, ctx, dst, amount);
    }
  }
  onHitReceived(ctx: BattleContext, src: Unit, amount: number): void {
    this.skillTrigger.trigger(ctx, this, "onHitReceived");
    for (const callback of [...(this.status.triggers.onHitReceived ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onDamageDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.skillTrigger.trigger(ctx, this, "onDamageDealt", amount);
    for (const callback of [...(this.status.triggers.onDamageDealt ?? [])]) {
      callback(this, ctx, dst, amount);
    }
  }
  onDamageReceived(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.skillTrigger.trigger(ctx, this, "onDamageReceived", amount);
    for (const callback of [...(this.status.triggers.onDamageReceived ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onHeal(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.skillTrigger.trigger(ctx, this, "onHeal");
    for (const callback of [...(this.status.triggers.onHeal ?? [])]) {
      callback(this, ctx, src, amount);
    }
  }
  onKill(ctx: BattleContext, dst: Unit): void {
    this.skillTrigger.trigger(ctx, this, "onKill");
    for (const callback of [...(this.status.triggers.onKill ?? [])]) {
      callback(this, ctx, dst);
    }
  }
}
