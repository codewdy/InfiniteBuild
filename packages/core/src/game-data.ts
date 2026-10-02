/*
 * 所有跟游戏有关的静态数据
 */

import type { Unit } from "./battle/unit.js";
import type { BattleContext } from "./battle/battle.js";

export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: number;
  };
  event: {
    maxEventPerUnit: {
      damage: number;
    };
  };
};

export type UnitDefinition = {
  kind: string;
  maxHp: number;
  move: {
    speed: number;
    range: number;
  };
  onUpdate: (self: Unit, ctx: BattleContext) => void;
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
  config: Config;
};
