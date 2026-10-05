import { Attribute } from "@infinite-build/core";
import type { Tablet, UnitSkill } from "@infinite-build/core";
import { fireball, nova } from "./skills.js";

export type TabletKind = "fireball" | "nova";

export const tabletOptions = [
  { kind: "fireball", name: "火球石板", description: "10 伤害 · 每 2 帧施放 · 射程 5" },
  { kind: "nova", name: "新星石板", description: "6 伤害 · 每 5 帧施放 · 半径 20" },
] as const;

export interface MockTablet extends Tablet {
  readonly kind: TabletKind;
  readonly slot: number;
  readonly name: string;
}

export function createTablet(kind: TabletKind, slot: number): MockTablet {
  const option = tabletOptions.find((entry) => entry.kind === kind)!;
  return {
    kind,
    slot,
    name: option.name,
    applyModifier(modifiers, id) {
      const modifier = modifiers[id]!;
      modifier.power.base += kind === "fireball" ? 10 : 6;
      modifier["cast.onUpdate"].base += kind === "fireball" ? 0.5 : 0.2;
    },
    applyPlayer(modifier, player) {
      const damage = Attribute.resolve(modifier.power);
      const castRate = Attribute.resolve(modifier["cast.onUpdate"]);
      const uuid = `mock-tablet-${slot}-${kind}`;
      const skill: UnitSkill = kind === "fireball"
        ? fireball.skill({ uuid, castRate, params: { damage, range: 5, projectileSpeed: 1 } })
        : nova.skill({ uuid, castRate, params: { damage, radius: 20, durationFrames: 10 } });
      (player.skills.onUpdate ??= []).push(skill);
    },
  };
}
