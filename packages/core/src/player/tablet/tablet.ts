import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { Attribute } from "../../battle/combat/attribute.js";
import type { PlayerStatus } from "../build.js";

export namespace Tablet {
  export const ModifierFieldName = [
    "power",
    ...SkillTrigger.eventTypes.map((type) => `skill.${type}` as const),
  ] as const;
  export type ModifierField = (typeof ModifierFieldName)[number];
  export type Modifier = Attribute.Dict<ModifierField>;
}

export interface Tablet {
  applyModifier(
    tablets: (Tablet | undefined)[],
    modifiers: Tablet.Modifier[],
    id: number,
  ): void;
  applyPlayer(
    tablets: (Tablet | undefined)[],
    modifier: Tablet.Modifier,
    player: PlayerStatus,
  ): void;
}
