import type {
  BattleSpec,
  MapLevel,
  PlayerState,
  BattleSettlement,
  Item,
} from "@infinite-build/core";

export namespace GameInterface {
  export type ValidateError = { kind: string; message: string };
  export type Battle = { uuid: string; spec: BattleSpec; player: PlayerState };
  export type BattleResult = {
    uuid: string;
    result: "Victory" | "Defeat";
    frame: number;
  };
}

/** State management contract. Implementations do not drive UI or battle timers. */
export interface GameInterface {
  readonly player: PlayerState;
  readonly battle: GameInterface.Battle | undefined;
  getState(): PlayerState;
  startLevel(level?: MapLevel): GameInterface.Battle;
  startBattle(spec: BattleSpec): GameInterface.Battle;
  battleResult(result: GameInterface.BattleResult): BattleSettlement;
  changeState(player: PlayerState): GameInterface.ValidateError | null;
  /** Explicit state override for development tools or loading a snapshot. */
  forceChangeState(player: PlayerState): void;
  completeTutorial(tutorial: string): void;
  deleteItem(uuid: string): void;
  openLoots(
    loot: PlayerState["pendingLoot"][number]["loot"],
    count?: number,
  ): { player: PlayerState; items: Item[] };
}
