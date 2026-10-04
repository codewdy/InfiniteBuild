/*
 * 所有跟游戏有关的静态数据
 */

import type { UnitDefinition } from "./battle/combat/regular-unit.js";
import type { SkillDefinition } from "./battle/combat/skill.js";

export type { UnitDefinition } from "./battle/combat/regular-unit.js";
export type { SkillDefinition, SkillParams } from "./battle/combat/skill.js";

export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: number;
  };
  event: {
    maxEventPerUnit: {
      damage: number;
      effect: number;
    };
  };
};

export type MapDefinition = {
  totalValue: number;
  spawner: {
    mapSize: number;
    value: number;
    weight: number;
    enemies: {
      kind: string;
      count: {
        min: number;
        max: number;
      };
    }[];
  }[];
};

export type GameData = {
  unitDefinitions: Record<string, UnitDefinition>;
  mapDefinitions: Record<string, MapDefinition>;
  skillDefinitions: Record<string, SkillDefinition>;
  config: Config;
};
