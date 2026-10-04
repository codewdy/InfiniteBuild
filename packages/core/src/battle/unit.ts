import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  maxHp: number = 1;
  hp: number = 1;
  lastHitUnit: Unit | null = null;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ maxHp: 1 }),
  );
  status: Status.Status = Status.createByConfig({ maxHp: 1 });

  abstract calcBaseStatus(ctx: BattleContext): Status.Status;
  abstract onMove(ctx: BattleContext): void;
  abstract onUpdate(ctx: BattleContext): void;
  abstract onDeath(ctx: BattleContext): void;
  abstract onHitDealt(ctx: BattleContext, dst: Unit, amount: number): void;
  abstract onHitReceived(ctx: BattleContext, src: Unit, amount: number): void;
  abstract onDamageDealt(ctx: BattleContext, dst: Unit, amount: number): void;
  abstract onDamageReceived(
    ctx: BattleContext,
    src: Unit | null,
    amount: number,
  ): void;
  abstract onHeal(ctx: BattleContext, src: Unit | null, amount: number): void;
  abstract onKill(ctx: BattleContext, dst: Unit): void;
}
