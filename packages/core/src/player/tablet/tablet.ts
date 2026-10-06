import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { Attribute } from "../../battle/combat/attribute.js";
import type { PlayerCombatProfile } from "../state.js";
import type { Status } from "../../battle/combat/status.js";

export namespace Tablet {
  export const AttributeFieldName = [
    "power",
    ...SkillTrigger.eventTypes.map((type) => `skill.${type}` as const),
  ] as const;
  export type AttributeField = (typeof AttributeFieldName)[number];
  export type Modifier = {
    skillStatus: Status.Modifier[];
    attribute: Attribute.Dict<AttributeField>;
  };
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
    player: PlayerCombatProfile,
  ): void;
}
