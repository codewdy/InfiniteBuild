import { Unit } from "./unit.js";
import { CombatResolver } from "./combat/combat-resolver.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";
import type { RandomGenerator } from "./random-generator.js";
export class RegularUnit extends Unit {
  private definition: UnitDefinition;
  private moveRange: number;
  constructor(
    definition: UnitDefinition,
    position: number,
    faction: Faction,
    rng: RandomGenerator,
  ) {
    super();
    this.kind = definition.kind;
    this.position = position;
    this.faction = faction;
    this.definition = definition;
    this.skills = structuredClone(definition.skills);
    for (const { uuid } of this.skills.onUpdate ?? []) {
      this.skillProgress.set(uuid, rng.rand());
    }
    const { min, max } = definition.move.range;
    this.moveRange = rng.uniform(min, max);
  }
  override calcBaseStatus(ctx: BattleContext): Status.Status {
    return Status.createByConfig(this.definition.status);
  }
  override onMove(ctx: BattleContext): void {
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
      Math.max(0, nearestDistance - this.moveRange),
    );
    CombatResolver.move(ctx, this, direction, distanceToMove);
  }
}
