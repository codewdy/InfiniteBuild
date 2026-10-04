/*
 * 所有跟游戏有关的静态数据
 */

import type { Config } from "./config.js";
import type { MapDefinition } from "./battle/spawn.js";
import type { BuffDefinition } from "./battle/combat/buff.js";
import type { UnitDefinition } from "./battle/combat/regular-unit.js";
import type { SkillDefinition } from "./battle/combat/skill.js";

export type { UnitDefinition } from "./battle/combat/regular-unit.js";
export type { SkillDefinition, SkillParams } from "./battle/combat/skill.js";

export type GameData = {
  unitDefinitions: Record<string, UnitDefinition>;
  mapDefinitions: Record<string, MapDefinition>;
  skillDefinitions: Record<string, SkillDefinition>;
  buffDefinitions: Record<string, BuffDefinition>;
  config: Config;
};
