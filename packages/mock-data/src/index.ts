import { Attribute, TabletMap } from "@infinite-build/core";
import { createTablet, tabletDefinition } from "./tablets.js";
export {
  createPassiveTablet,
  createSupportTablet,
  createTablet,
  tabletOptions,
  supportTabletOptions,
  tabletDefinition,
} from "./tablets.js";
export { rollPassiveTablet, passiveTabletOptions } from "./tablets.js";
export type { MockTablet, TabletKind } from "./tablets.js";
import type { BattleSpec, GameData, PlayerState } from "@infinite-build/core";

import {
  attack,
  fireball,
  chainLightning,
  nova,
  skillDefinitions,
} from "./skills.js";
import { buffDefinitions } from "./buffs.js";
import { passiveAffixes, supportSkillAffixes } from "./affixes.js";
export { passiveAffixes, supportSkillAffixes } from "./affixes.js";

export const playerState: PlayerState = {
  currentMapLevel: [1, 1],
  highestUnlockedMapLevel: [1, 1],
  // Three skill rarities for comparing artwork and claiming loot.
  pendingLoot: [
    { loot: { kind: "tablet-skill", rarity: "normal", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "magic", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "rare", level: 1 }, count: 3 },
  ],
  inventory: [createTablet("fireball", TabletMap.idSize)],
  tutorial: { completed: [] },
  config: { autoAdvanceLevel: false, minimumEnemyCount: 2 },
  level: 1,
  xp: 0,
  tablets: Array.from({ length: TabletMap.idSize }, (_, slot) =>
    slot === 1 ? createTablet("chainLightning", slot) : null,
  ),
};

const battlefieldVisionRange = 20;

export const gameData: GameData = {
  affixDefinition: {
    tablet: {
      support: supportSkillAffixes,
      passive: passiveAffixes,
    },
  },
  playerDefinition: {
    tablet: tabletDefinition,
    defaultState: playerState,
    inventoryCapacity: 20,
    levelXP: [0, 100, 300, 600, 1000],
    loot: {
      min: 1,
      max: 3,
      pool: [
        { kind: "tablet-skill", rarity: "magic", weight: 1 },
        { kind: "tablet-passive", rarity: "magic", weight: 1 },
        { kind: "tablet-support-skill", rarity: "magic", weight: 1 },
      ],
    },
    baseStatus: {
      attributes: Attribute.createDictByRaw({
        maxHp: 10,
        speed: 1,
      }),
      triggers: {},
    },
    skills: {
      fireball: fireball.skill({
        uuid: "player-fireball-template",
        castRate: 0.5,
        params: {
          damage: 10,
          projectileSpeed: 1,
          range: battlefieldVisionRange,
          bounce: 3,
        },
      }),
      chainLightning: chainLightning.skill({
        uuid: "player-chain-lightning-template",
        castRate: 0.2,
        params: { damage: 10, range: battlefieldVisionRange },
      }),
      nova: nova.skill({
        uuid: "player-nova-template",
        castRate: 0.2,
        params: { damage: 6, radius: 20, durationFrames: 10 },
      }),
    },
  },
  config: {
    map: { spawnMinimumSize: 5, visionRange: battlefieldVisionRange },
    event: { maxEventPerUnit: { damage: 10, effect: 10 } },
  },
  skillDefinitions,
  buffDefinitions,
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      name: "史莱姆",
      status: { attributes: { maxHp: 20, attack: 5, defense: 0, speed: 0.5 } },
      skills: {
        onUpdate: [
          attack.skill({
            uuid: "slime-attack",
            castRate: 0.1,
            params: { range: 2 },
          }),
        ],
      },
    },
    Goblin: {
      kind: "Goblin",
      name: "哥布林",
      status: { attributes: { maxHp: 30, attack: 5, defense: 0, speed: 1 } },
      skills: {
        onUpdate: [
          attack.skill({
            uuid: "goblin-attack",
            castRate: 0.1,
            params: { range: 3 },
          }),
        ],
      },
    },
  },
  mapDefinitions: {
    grassland: {
      name: "草原",
      background: "grassland",
      xp: 100,
      totalValue: 60,
      spawner: [
        {
          mapSize: 5,
          value: 1,
          weight: 1,
          enemies: [{ kind: "Slime", count: { min: 1, max: 3 } }],
        },
      ],
    },
    forest: {
      name: "林地",
      background: "forest",
      xp: 100,
      totalValue: 1,
      spawner: [
        {
          mapSize: 5,
          value: 1,
          weight: 1,
          enemies: [{ kind: "Slime", count: { min: 5, max: 5 } }],
        },
      ],
    },
  },
  mapLevelDefinitions: [
    {
      level: [1, 1],
      name: "林地",
      maps: ["forest"],
    },
    {
      level: [1, 2],
      name: "草原",
      maps: ["grassland"],
    },
  ],
};

export const battleSpec: BattleSpec = {
  level: [1, 1],
  seed: 42,
  map: "forest",
};
