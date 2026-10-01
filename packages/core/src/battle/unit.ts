import type { BattleContext, Faction } from "./battle.js";

export interface Unit {
  id: number;
  kind: string;
  faction: Faction;
  position: number;
  move(ctx: BattleContext): void;
  onUpdate(ctx: BattleContext): void;
}
