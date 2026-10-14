import type { PlayerState } from "@infinite-build/core";

export const EQUIP_SKILL_TUTORIAL = "equip-skill-tablet";

/** The frontend decides which tutorials a successful player action completes. */
export function completedTutorials(previous: PlayerState, current: PlayerState): string[] {
  if (current.tutorial.completed.includes(EQUIP_SKILL_TUTORIAL)) return [];
  const equippedSkill = previous.inventory.some(
    (item) => item?.kind === "tablet-skill" &&
      current.tablets.some((tablet) => tablet?.uuid === item.uuid),
  );
  return equippedSkill ? [EQUIP_SKILL_TUTORIAL] : [];
}
