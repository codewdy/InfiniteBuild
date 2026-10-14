import type { PlayerState } from "@infinite-build/core";

export const EQUIP_SKILL_TUTORIAL = "equip-skill-tablet";

/** The frontend decides which tutorials a successful player action completes. */
export function completedTutorials(
  previous: PlayerState,
  current: PlayerState,
): string[] {
  if (current.tutorial.completed.includes(EQUIP_SKILL_TUTORIAL)) return [];
  const equippedSkill = previous.inventory.some(
    (item) =>
      item?.kind === "tablet-skill" &&
      current.tablets.some((tablet) => tablet?.uuid === item.uuid),
  );
  return equippedSkill ? [EQUIP_SKILL_TUTORIAL] : [];
}

export const SELECT_LEVEL_TUTORIAL = "select-level-1-2";

/** Progress beyond 1-1 is granted by core only after a victory. */
export function challengesUnlocked(state: PlayerState): boolean {
  const [chapter, level] = state.highestUnlockedMapLevel;
  return chapter > 1 || (chapter === 1 && level >= 2);
}

export function levelTutorialPending(state: PlayerState): boolean {
  return (
    challengesUnlocked(state) &&
    !state.tutorial.completed.includes(SELECT_LEVEL_TUTORIAL)
  );
}
