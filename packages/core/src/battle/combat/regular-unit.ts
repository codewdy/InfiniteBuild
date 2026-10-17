import type { Position } from "../position.js";
import type { UnitSkills } from "./skill-trigger.js";
import { Unit, type Faction } from "./unit.js";
import { moveBySkillRange } from "./movement.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";
import type { RandomGenerator } from "../../random-generator.js";

export type UnitDefinition = {
  kind: string;
  name: string;
  collisionRadius: number;
  status: Status.StatusConfig;
  skills: UnitSkills;
};

export class RegularUnit extends Unit {
  private definition: UnitDefinition;
  constructor(
    definition: UnitDefinition,
    position: Position,
    faction: Faction,
    rng: RandomGenerator,
  ) {
    super();
    this.kind = definition.kind;
    this.name = definition.name;
    this.collisionRadius = definition.collisionRadius;
    this.position = { ...position };
    this.faction = faction;
    this.definition = definition;
    this.skills = structuredClone(definition.skills);
    this.skillTrigger.initializeProgress(rng, this);
  }
  override calcBaseStatus(ctx: BattleContext): Status {
    return Status.createByConfig(this.definition.status);
  }
  override onMove(ctx: BattleContext): void {
    if ((this.rawStatus.attributes.speed ?? 0) <= 0) {
      return;
    }
    moveBySkillRange(ctx, this);
  }
}
