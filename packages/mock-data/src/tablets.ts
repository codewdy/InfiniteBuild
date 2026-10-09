import type { TabletDefinition, TabletSpec } from "@infinite-build/core";
import { Affix } from "@infinite-build/core";
import type { RandomGenerator } from "@infinite-build/core";
import { passiveAffixes } from "./affixes.js";

export const supportTabletOptions = [
  { id: "adjacent", name: "相邻单格", delta: [[1, 0]] },
  { id: "distant", name: "远距单格", delta: [[2, 0]] },
  { id: "line", name: "同向双格", delta: [[1, 0], [2, 0]] },
  { id: "diagonal", name: "斜向单格", delta: [[1, -1]] },
  { id: "opposite", name: "双向两格", delta: [[1, 0], [-1, 0]] },
  { id: "diagonalPair", name: "斜向双格", delta: [[1, -1], [1, 1]] },
] satisfies TabletDefinition["targetSelection"];

export const tabletDefinition: TabletDefinition = {
  targetSelection: supportTabletOptions,
};

export const passiveTabletOptions = [
  { name: "低级", level: 1 },
  { name: "中级", level: 20 },
  { name: "高级", level: 40 },
] as const;

export function rollPassiveTablet(
  rng: RandomGenerator,
  level: number,
): TabletSpec.Passive {
  return {
    kind: "tablet-passive",
    rarity: "magic",
    uuid: crypto.randomUUID(),
    affixes: Affix.rollAffixes(rng, passiveAffixes, ["tablet-passive"], level),
  };
}

export type TabletKind = "fireball" | "nova";
export type MockTablet = TabletSpec.Skill;

export const tabletOptions = [
  {
    kind: "fireball",
    name: "火球",
    description: "10 伤害 · 每 2 帧施放 · 射程 5",
  },
  {
    kind: "nova",
    name: "新星",
    description: "6 伤害 · 每 5 帧施放 · 半径 20",
  },
] as const;

export function createTablet(kind: TabletKind, slot: number): MockTablet {
  return {
    kind: "tablet-skill",
    rarity: "magic",
    uuid: `mock-tablet-${slot}-${kind}`,
    skill: kind,
    affixes: [],
  };
}

export function createSupportTablet(
  slot: number,
  targetSelection = "adjacent",
): TabletSpec.SupportSkill {
  return {
    kind: "tablet-support-skill",
    rarity: "magic",
    uuid: `mock-tablet-${slot}-${targetSelection}-cast-rate-support`,
    rotate: 0,
    targetSelection,
    affixes: [{ id: "onUpdateCastRate", tier: 0, param: 0.5 }],
  };
}

export function createPassiveTablet(slot: number): TabletSpec.Passive {
  return {
    kind: "tablet-passive",
    rarity: "magic",
    uuid: `mock-tablet-${slot}-max-hp`,
    affixes: [{ id: "maxHp", tier: 0, param: 10 }],
  };
}
