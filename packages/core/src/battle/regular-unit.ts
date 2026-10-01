import type { Unit } from "./unit.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext, Faction } from "./battle.js";
export class RegularUnit implements Unit {
  kind: string;
  faction: Faction;
  position: number;
  constructor(definition: UnitDefinition, position: number, faction: Faction) {
    this.kind = definition.kind;
    this.position = position;
    this.faction = faction;
  }
  onUpdate(ctx: BattleContext): void {}
}
