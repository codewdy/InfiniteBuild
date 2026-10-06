import type { Config } from "./config.js";
import type { MapDefinition } from "./battle/spawn.js";
import type { BuffDefinition } from "./battle/combat/buff.js";
import type { UnitDefinition } from "./battle/combat/regular-unit.js";
import type { SkillDefinition } from "./battle/combat/skill.js";

import {
  defineSkill as defineSkillImpl,
  skills as skillsImpl,
} from "./game-data/skill.js";

import {
  defineBuff as defineBuffImpl,
  buffs as buffsImpl,
} from "./game-data/buff.js";
import type { PlayerDefinition } from "./player/definition.js";
import type { Affix } from "./player/affix.js";
import type { SupportTablet } from "./player/tablet/support.js";

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
  playerDefinition: PlayerDefinition;
  affixDefinition: {
    tablet: {
      support: {
        skill: Affix.Definitions<SupportTablet.Apply>;
        passive: Affix.Definitions<SupportTablet.Apply>;
      };
    };
  };
  config: Config;
};

export namespace GameData {
  export const defineBuff: typeof defineBuffImpl = defineBuffImpl;
  export const buffs: typeof buffsImpl = buffsImpl;
  export const defineSkill: typeof defineSkillImpl = defineSkillImpl;
  export const skills: typeof skillsImpl = skillsImpl;
}
