import type { BattleLog, BattleSpec, GameData, MapLevel, PlayerState } from "@infinite-build/core";
export type { BattlefieldResult, BattlefieldResetOptions } from "@infinite-build/renderer";

export type SlotLocation = { area: "tablets" | "inventory"; index: number };
export type PendingLootItem = PlayerState["pendingLoot"][number]["loot"];

/** Callbacks express user intent; the host applies changes and supplies fresh state. */
export type GameUIOptions = {
  gameData: GameData;
  onSelectLevel?: (level: MapLevel) => void;
  onAutoAdvanceLevelChange?: (enabled: boolean) => void;
  onMoveTablet?: (uuid: string, target: SlotLocation) => void;
  onRotateTablet?: (uuid: string) => void;
  onClaimLoot?: (loot: PendingLootItem, count?: number) => void;
  onTogglePlaying?: () => void;
};

export type GameUIState = {
  player: PlayerState;
  battle: { log: BattleLog; spec: BattleSpec; playing: boolean; frameDuration: number };
};
