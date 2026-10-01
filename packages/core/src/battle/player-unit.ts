import type { Unit } from "./unit.js";
import type { BattleContext, Faction } from "./battle.js";
export class PlayerUnit implements Unit {
  id: number = -1;
  kind: string;
  faction: Faction = "Ally";
  position: number;
  constructor() {
    this.kind = "Player";
    this.position = 0;
  }
  onUpdate(ctx: BattleContext): void {}
}
