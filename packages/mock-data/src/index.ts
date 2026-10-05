import type {
  BattleSpec,
  GameData,
  PlayerBuild,
} from "@infinite-build/core";

import { fireball, nova, selfDestruct, skillDefinitions } from "./skills.js";
import { buffDefinitions } from "./buffs.js";

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
    event: { maxEventPerUnit: { damage: 10, effect: 10 } },
  },
  skillDefinitions,
  buffDefinitions,
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      status: { attributes: { maxHp: 20, attack: 5, defense: 0 }, tags: [] },
      move: { speed: 0.5, range: { min: 1.5, max: 2 } },
      skills: {
        onDeath: [
          selfDestruct.skill({
            uuid: "slime-self-destruct",
            params: { damage: 1, radius: 2 },
          }),
        ],
      },
    },
    Goblin: {
      kind: "Goblin",
      status: { attributes: { maxHp: 30, attack: 5, defense: 0 }, tags: [] },
      move: { speed: 1, range: { min: 2.5, max: 3 } },
      skills: {
        onUpdate: [
          fireball.skill({
            uuid: "goblin-fireball",
            castRate: 0.1,
            params: { damage: 0.1, range: 5, projectileSpeed: 1 },
          }),
        ],
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

export const playerBuild: PlayerBuild = {
  level: 1,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
  skills: {
    onUpdate: [
      fireball.skill({
        uuid: "mock-player-fireball",
        castRate: 0.5,
        params: { damage: 10, range: 5, projectileSpeed: 1 },
      }),
      nova.skill({
        uuid: "mock-player-nova",
        castRate: 0.2,
        params: { damage: 6, radius: 20, durationFrames: 10 },
      }),
    ],
  },
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
