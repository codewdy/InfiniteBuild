import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  maxHp: number = 1;
  hp: number = 1;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ maxHp: 1 }),
  );
  status: Status.Status = Status.createByConfig({ maxHp: 1 });

  abstract calcBaseStatus(ctx: BattleContext): Status.Status;
  abstract onMove(ctx: BattleContext): void;
  abstract onUpdate(ctx: BattleContext): void;
  abstract onDeath(ctx: BattleContext): void;
}
