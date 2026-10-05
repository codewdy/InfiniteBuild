import type { Attribute } from "../../battle/combat/attribute.js";
import type { PlayerStatus } from "../build.js";

export namespace Tablet {
  export const ModifierFieldName = ["power", "cast.onUpdate"] as const;
  export type ModifierField = (typeof ModifierFieldName)[number];
  export type Modifier = Attribute.Dict<ModifierField>;
}

export interface Tablet {
  applyModifier(modifiers: Tablet.Modifier[], id: number): void;
  applyPlayer(modifier: Tablet.Modifier, player: PlayerStatus): void;
}
