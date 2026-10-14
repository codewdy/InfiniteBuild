import type { PlayerCombatProfile } from "../state.js";
import type { Tablet } from "./tablet.js";

function defaultModifier(): Tablet.Modifier {
  return {
    skillStatus: [],
    attribute: {},
  };
}

export function tabletRun(
  slots: (Tablet | undefined)[],
  player: PlayerCombatProfile,
): void {
  const modifiers = Array.from({ length: slots.length }, () =>
    defaultModifier(),
  );

  slots.forEach((tablet) => {
    tablet?.applyModifier(modifiers);
  });

  slots.forEach((tablet, id) => {
    tablet?.applyPlayer(modifiers[id]!, player);
  });
}
