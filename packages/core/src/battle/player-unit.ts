import type { Unit } from "./unit.js";
import type { BattleContext } from "./battle.js";
export class PlayerUnit implements Unit {
  kind: string;
  position: number;
  constructor() {
    this.kind = "Player";
    this.position = 0;
  }
  onUpdate(ctx: BattleContext): void {}
}
