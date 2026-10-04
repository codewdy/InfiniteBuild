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
