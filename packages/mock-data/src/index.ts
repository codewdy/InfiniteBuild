import { Attribute, TabletMap } from "@infinite-build/core";
import {
  createPassiveTablet,
  createSupportTablet,
  createTablet,
} from "./tablets.js";
export {
  createPassiveTablet,
  createSupportTablet,
  createTablet,
  tabletOptions,
} from "./tablets.js";
export { rollPassiveTablet, passiveTabletOptions } from "./tablets.js";
export type { MockTablet, TabletKind } from "./tablets.js";
import type { BattleSpec, GameData, PlayerState } from "@infinite-build/core";

import { fireball, nova, selfDestruct, skillDefinitions } from "./skills.js";
import { buffDefinitions } from "./buffs.js";
import { passiveAffixes, supportSkillAffixes } from "./affixes.js";
export { passiveAffixes, supportSkillAffixes } from "./affixes.js";

const supportTablet = createSupportTablet(TabletMap.idSize + 4);
const passiveTablet = createPassiveTablet(TabletMap.idSize + 5);

export const playerState: PlayerState = {
  inventory: [
    ...(["fireball", "nova", "fireball", "nova"] as const).map(
      (kind, index) => {
        const tablet = createTablet(kind, TabletMap.idSize + index);
        return { kind: "tablet" as const, uuid: tablet.uuid, tablet };
      },
    ),
    { kind: "tablet", uuid: supportTablet.uuid, tablet: supportTablet },
    { kind: "tablet", uuid: passiveTablet.uuid, tablet: passiveTablet },
    null,
  ],
  level: 1,
  xp: 0,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
  tablets: Array.from({ length: TabletMap.idSize }, (_, id) =>
    id === 0
      ? createTablet("fireball", id)
      : id === 1
        ? createTablet("nova", id)
        : null,
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
    defaultState: playerState,
    levelXP: [0, 100, 300, 600, 1000],
    loot: {
      min: 1,
      max: 3,
      pool: [
        { kind: "tablet-skill", weight: 1 },
        { kind: "tablet-passive", weight: 1 },
        { kind: "tablet-support-skill", weight: 1 },
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
      name: "哥布林",
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
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
