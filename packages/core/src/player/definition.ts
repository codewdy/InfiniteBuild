import type { UnitSkill } from "../battle/combat/skill-trigger.js";
import type { Status } from "../battle/combat/status.js";

export type PlayerDefinition = {
  baseStatus: Status;
  skills: Record<string, UnitSkill>;
};
