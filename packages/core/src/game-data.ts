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
      type: string;
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
