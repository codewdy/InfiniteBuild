import type { TabletSpec } from "@infinite-build/core";

export type TabletKind = "fireball" | "nova";
export type MockTablet = TabletSpec.Skill;

export const tabletOptions = [
  { kind: "fireball", name: "火球石板", description: "10 伤害 · 每 2 帧施放 · 射程 5" },
  { kind: "nova", name: "新星石板", description: "6 伤害 · 每 5 帧施放 · 半径 20" },
] as const;

export function createTablet(kind: TabletKind, slot: number): MockTablet {
  return {
    kind: "skill",
    uuid: `mock-tablet-${slot}-${kind}`,
    skill: kind,
    rotate: 0,
  };
}

export function createSupportTablet(slot: number): TabletSpec.SupportSkill {
  return {
    kind: "support-skill",
    uuid: `mock-tablet-${slot}-cast-rate-support`,
    rotate: 0,
    delta: [[1, 0]],
    affixes: [{ id: "onUpdateCastRate", tier: 0, param: 0.5 }],
  };
}
