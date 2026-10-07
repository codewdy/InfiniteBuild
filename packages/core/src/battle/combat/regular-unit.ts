import type { UnitSkills } from "./skill-trigger.js";
import { Unit, type Faction } from "./unit.js";
import { move } from "./movement.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";
import type { RandomGenerator } from "../../random-generator.js";

export type UnitDefinition = {
  kind: string;
  status: Status.StatusConfig;
  move: {
    speed: number;
    range: {
      min: number;
      max: number;
    };
  };
  skills: UnitSkills;
};

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
    this.skillTrigger.initializeProgress(rng, this);
    const { min, max } = definition.move.range;
    this.moveRange = rng.uniform(min, max);
  }
  override calcBaseStatus(ctx: BattleContext): Status {
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
    move(ctx, this, direction, distanceToMove);
  }
}
