import type { UnitSkill } from "../battle/combat/skill-trigger.js";
import type { Status } from "../battle/combat/status.js";
import type { Loot } from "./loot.js";
import type { PlayerState } from "./state.js";

export type PlayerDefinition = {
  baseStatus: Status;
  skills: Record<string, UnitSkill>;
  defaultState: PlayerState;
  loot: Loot.Definition;
  levelXP: number[];
};
