import type { TabletSpec } from "@infinite-build/core";
import { Affix } from "@infinite-build/core";
import type { RandomGenerator } from "@infinite-build/core";
import { passiveAffixes } from "./affixes.js";

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

export function createSupportTablet(slot: number): TabletSpec.SupportSkill {
  return {
    kind: "tablet-support-skill",
    rarity: "magic",
    uuid: `mock-tablet-${slot}-cast-rate-support`,
    rotate: 0,
    targetSelection: "adjacent",
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
