/*
 * 所有跟游戏有关的静态数据
 */

export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: number;
  };
};

export type UnitDefinition = {
  maxHp: number;
};

export type MapDefinition = {
  totalValue: number;
  spawner: {
    mapSize: number;
    value: number;
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
