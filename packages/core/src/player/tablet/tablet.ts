import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { Attribute } from "../../battle/combat/attribute.js";
import type { PlayerCombatProfile } from "../state.js";
import type { Status } from "../../battle/combat/status.js";
import type { TabletMap } from "./map.js";
import type { TabletSpec } from "./spec.js";
import type { GameData } from "../../game-data.js";

export namespace Tablet {
  export const AttributeFieldName = [
    ...SkillTrigger.eventTypes.map((type) => `skill.${type}` as const),
  ] as const;
  export type AttributeField = (typeof AttributeFieldName)[number];
  export type Modifier = {
    skillStatus: Status.Modifier[];
    attribute: Attribute.Dict<AttributeField>;
  };
  export type Context = {
    gameData: GameData;
    slots: TabletSpec.Slot[];
    id: number;
    rotate: TabletMap.Rotate;
  };
}

export interface Tablet {
  applyModifier(modifiers: Tablet.Modifier[]): void;
  applyPlayer(modifier: Tablet.Modifier, player: PlayerCombatProfile): void;
}
