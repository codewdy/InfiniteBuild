export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: { x: number; y: number };
  };
  event: {
    maxEventPerUnit: {
      damage: number;
      effect: number;
    };
  };
};
