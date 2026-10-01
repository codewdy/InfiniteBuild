import type { BattleSpec, GameData, PlayerState } from "@infinite-build/core";

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
  },
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      maxHp: 20,
      move: { speed: 0.5, range: 2 },
      onUpdate(self) {
        self.hp -= 1;
      },
    },
    Goblin: {
      kind: "Goblin",
      maxHp: 30,
      move: { speed: 1, range: 3 },
      onUpdate(self) {
        self.hp -= 1;
      },
    },
  },
  mapDefinitions: {
    demo: {
      totalValue: 60,
      spawner: [
        {
          mapSize: 5,
          value: 1,
          weight: 2,
          enemies: [{ kind: "Slime", count: { min: 1, max: 3 } }],
        },
        {
          mapSize: 7,
          value: 2,
          weight: 1,
          enemies: [{ kind: "Goblin", count: { min: 2, max: 3 } }],
        },
      ],
    },
  },
};

export const playerState: PlayerState = {
  level: 1,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
