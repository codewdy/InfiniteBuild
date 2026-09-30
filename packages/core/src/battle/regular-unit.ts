import type { Unit } from "./unit.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext } from "./battle.js";
export class RegularUnit implements Unit {
  kind: string;
  position: number;
  constructor(definition: UnitDefinition, position: number) {
    this.kind = definition.kind;
    this.position = position;
  }
  onUpdate(ctx: BattleContext): void {}
}
