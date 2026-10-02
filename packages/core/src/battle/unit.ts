import type { BattleContext, Faction } from "./battle.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  hp!: number;
  abstract move(ctx: BattleContext): void;
  abstract onUpdate(ctx: BattleContext): void;
}
