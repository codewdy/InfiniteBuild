import type { Config } from "./config.js";
import type { MapDefinition } from "./battle/spawn.js";
import type { BuffDefinition } from "./battle/combat/buff.js";
import type { UnitDefinition } from "./battle/combat/regular-unit.js";
import type { SkillDefinition } from "./battle/combat/skill.js";

import {
  defineSkill as defineSkillImpl,
  skills as skillsImpl,
} from "./game-data/skill.js";

export type { UnitDefinition } from "./battle/combat/regular-unit.js";
export type {
  SkillDefinition,
  SkillParams,
  SkillContext,
  SkillCaster,
} from "./battle/combat/skill.js";

export type GameData = {
  unitDefinitions: Record<string, UnitDefinition>;
  mapDefinitions: Record<string, MapDefinition>;
  skillDefinitions: Record<string, SkillDefinition>;
  buffDefinitions: Record<string, BuffDefinition>;
  config: Config;
};

export namespace GameData {
  export const defineSkill: typeof defineSkillImpl = defineSkillImpl;
  export const skills: typeof skillsImpl = skillsImpl;
}
