import { Attribute, TabletMap } from "@infinite-build/core";
import {
  createPassiveTablet,
  createSupportTablet,
  createTablet,
  supportTabletOptions,
  tabletDefinition,
} from "./tablets.js";
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

import { attack, fireball, nova, skillDefinitions } from "./skills.js";
import { buffDefinitions } from "./buffs.js";
import { passiveAffixes, supportSkillAffixes } from "./affixes.js";
export { passiveAffixes, supportSkillAffixes } from "./affixes.js";

const supportTablet = createSupportTablet(TabletMap.idSize + 4);
const passiveTablet = createPassiveTablet(TabletMap.idSize + 5);
const previewPassiveTablet = {
  ...createPassiveTablet(TabletMap.idSize + 6),
  rarity: "rare" as const,
  affixes: [
    { id: "attack", tier: 0, param: 3 },
    { id: "attackPercent", tier: 0, param: 0.1 },
    { id: "maxHp", tier: 0, param: 10 },
    { id: "maxHpPercent", tier: 0, param: 0.1 },
  ],
};

// One four-affix stone per tier provides samples of different affix tiers.
const tierPreviewTablets = Array.from({ length: 5 }, (_, tier) => ({
  ...createPassiveTablet(TabletMap.idSize + 7 + tier),
  rarity: "rare" as const,
  affixes: ["attack", "attackPercent", "maxHp", "maxHpPercent"].map((id) => {
    const range = passiveAffixes.pool[id]!.tier[tier]!;
    return { id, tier, param: (range.min + range.max) / 2 };
  }),
}));

export const playerState: PlayerState = {
  // Three skill rarities for comparing artwork and claiming loot.
  pendingLoot: [
    { loot: { kind: "tablet-skill", rarity: "normal", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "magic", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "rare", level: 1 }, count: 3 },
  ],
  inventory: [
    ...(["fireball", "nova", "fireball", "nova"] as const).map((kind, index) =>
      createTablet(kind, TabletMap.idSize + index),
    ),
    supportTablet,
    passiveTablet,
    previewPassiveTablet,
    ...tierPreviewTablets,
    ...supportTabletOptions
      .slice(1)
      .map(({ id }, index) =>
        createSupportTablet(TabletMap.idSize + 12 + index, id),
      ),
  ],
  level: 1,
  xp: 0,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
  // Fill the board to exercise the skill progress layout with all 25 skills.
  tablets: Array.from({ length: TabletMap.idSize }, (_, id) =>
    createTablet(id % 2 === 0 ? "fireball" : "nova", id),
  ),
};

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
      attributes: Attribute.createDictByRaw(["maxHp", "attack", "defense"], {
        maxHp: 10,
      }),
      tags: new Set(),
      triggers: {},
    },
    skills: {
      fireball: fireball.skill({
        uuid: "player-fireball-template",
        castRate: 0.5,
        params: { damage: 10, range: 5, projectileSpeed: 1 },
      }),
      nova: nova.skill({
        uuid: "player-nova-template",
        castRate: 0.2,
        params: { damage: 6, radius: 20, durationFrames: 10 },
      }),
    },
  },
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
    event: { maxEventPerUnit: { damage: 10, effect: 10 } },
  },
  skillDefinitions,
  buffDefinitions,
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      name: "史莱姆",
      status: { attributes: { maxHp: 20, attack: 5, defense: 0 }, tags: [] },
      move: { speed: 0.5, range: { min: 1.5, max: 2 } },
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
      status: { attributes: { maxHp: 30, attack: 5, defense: 0 }, tags: [] },
      move: { speed: 1, range: { min: 2.5, max: 3 } },
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
  mapLevelDefinitions: [
    {
      level: [1, 1],
      name: "启程",
      maps: ["forest", "grassland"],
    },
  ],
};

export const battleSpec: BattleSpec = { seed: 42, map: "forest" };
