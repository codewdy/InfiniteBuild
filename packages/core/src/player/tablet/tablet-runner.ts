import { Attribute } from "../../battle/combat/attribute.js";
import type { PlayerStatus } from "../build.js";
import { Tablet } from "./tablet.js";

function defaultModifier(): Tablet.Modifier {
  return Attribute.createDictByRaw(Tablet.ModifierFieldName);
}

export function tabletRun(
  slots: (Tablet | undefined)[],
  player: PlayerStatus,
): void {
  const modifiers = Array.from({ length: slots.length }, () =>
    defaultModifier(),
  );

  slots.forEach((tablet, id) => {
    tablet?.applyModifier(modifiers, id);
  });

  slots.forEach((tablet, id) => {
    tablet?.applyPlayer(modifiers[id]!, player);
  });
}
