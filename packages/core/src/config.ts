export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: { left: number; right: number; top: number; bottom: number };
  };
  event: {
    maxEventPerUnit: {
      damage: number;
      effect: number;
    };
  };
};
