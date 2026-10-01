import type { BattleSpec, GameData, PlayerState } from "@infinite-build/core";

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 15, visionRange: 20 },
  },
  unitDefinitions: {
    Slime: { kind: "Slime", maxHp: 10, move: { speed: 0.5, range: 1 } },
    Goblin: { kind: "Goblin", maxHp: 20, move: { speed: 1, range: 2 } },
  },
  mapDefinitions: {
    demo: {
      totalValue: 6,
      spawner: [
        {
          mapSize: 15,
          value: 1,
          weight: 2,
          enemies: [{ kind: "Slime", count: { min: 1, max: 2 } }],
        },
        {
          mapSize: 20,
          value: 2,
          weight: 1,
          enemies: [{ kind: "Goblin", count: { min: 1, max: 2 } }],
        },
      ],
    },
  },
};

export const playerState: PlayerState = {
  level: 1,
  move: { speed: 1, range: 5, count: 3 },
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
