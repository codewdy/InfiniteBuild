import type { BattleContext } from "./battle.js";

export interface Unit {
  kind: string;
  position: number;
  onUpdate(ctx: BattleContext): void;
}
