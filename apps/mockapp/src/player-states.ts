import { TabletMap, type PlayerState } from "@infinite-build/core";
import { createTablet, playerState } from "@infinite-build/mock-data";

export const testPlayerState: PlayerState = {
  currentMapLevel: [1, 2],
  highestUnlockedMapLevel: [1, 2],
  // Three skill rarities for comparing artwork and claiming loot.
  pendingLoot: [
    { loot: { kind: "tablet-skill", rarity: "normal", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "magic", level: 1 }, count: 3 },
    { loot: { kind: "tablet-skill", rarity: "rare", level: 1 }, count: 3 },
  ],
  inventory: [
    createTablet("fireball", TabletMap.idSize),
    ...(["fireball", "nova", "chainLightning"] as const).flatMap(
      (skill, skillIndex) =>
        (["normal", "magic", "rare"] as const).map((rarity, rarityIndex) => ({
          ...createTablet(
            skill,
            TabletMap.idSize + 1 + skillIndex * 3 + rarityIndex,
          ),
          rarity,
        })),
    ),
  ],
  tutorial: { completed: ["equip-skill-tablet", "select-level-1-2"] },
  config: { autoAdvanceLevel: false },
  level: 1,
  xp: 0,
  tablets: Array.from({ length: TabletMap.idSize }, (_, slot) =>
    slot === 1 ? createTablet("chainLightning", slot) : null,
  ),
};

export const initialPlayerStates: Record<"test" | "production", PlayerState> = {
  test: testPlayerState,
  production: playerState,
};
