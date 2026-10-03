import { Unit } from "./unit.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";
import type { RandomGenerator } from "./random-generator.js";
export class RegularUnit extends Unit {
  private definition: UnitDefinition;
  private skillProgress: number[];
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
    this.skillProgress = definition.skills.map(() => rng.rand());
    const { min, max } = definition.move.range;
    this.moveRange = rng.uniform(min, max);
  }
  onUpdateStatus(ctx: BattleContext): Status.Status {
    return Status.createByConfig(this.definition.status);
  }
  onMove(ctx: BattleContext): void {
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
    this.move(ctx, direction, distanceToMove);
  }
  onUpdate(ctx: BattleContext): void {
    super.onUpdate(ctx);
    for (let index = 0; index < this.definition.skills.length; index++) {
      const { skill, castRate } = this.definition.skills[index]!;
      this.skillProgress[index] = (this.skillProgress[index] ?? 0) + castRate;
      while (this.skillProgress[index]! >= 1) {
        this.skillProgress[index]! -= 1;
        this.cast(ctx, skill);
      }
    }
    if (this.definition.onUpdate) {
      this.definition.onUpdate(this, ctx);
    }
  }
  onDeath(ctx: BattleContext): void {
    if (this.definition.onDeath) {
      this.definition.onDeath(this, ctx);
    }
  }
}
