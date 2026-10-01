import type { Unit } from "./unit.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext, Faction } from "./battle.js";
export class RegularUnit implements Unit {
  id: number = -1;
  kind: string;
  faction: Faction;
  position: number;
  hp: number;
  private definition: UnitDefinition;
  constructor(definition: UnitDefinition, position: number, faction: Faction) {
    this.kind = definition.kind;
    this.position = position;
    this.faction = faction;
    this.definition = definition;
    this.hp = this.definition.maxHp;
  }
  move(ctx: BattleContext): void {
    const direction = this.faction === "Ally" ? 1 : -1;
    let nearestDistance = Infinity;
    for (const unit of ctx.units) {
      if (unit.faction === this.faction) continue;
      const distance = (unit.position - this.position) * direction;
      if (distance >= 0 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (nearestDistance === Infinity) return;

    const distanceToMove = Math.min(
      this.definition.move.speed,
      Math.max(0, nearestDistance - this.definition.move.range),
    );
    this.position += direction * distanceToMove;
  }
  onUpdate(ctx: BattleContext): void {
    this.definition.onUpdate(this, ctx);
  }
}
