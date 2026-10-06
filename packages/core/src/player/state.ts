import type { GameData } from "../game-data.js";
import { TabletSpec } from "./tablet/spec.js";
import type { UnitSkills } from "../battle/combat/skill-trigger.js";
import { Status } from "../battle/combat/status.js";
import { tabletRun } from "./tablet/runner.js";
import type { Inventory } from "./item/inventory.js";

export type PlayerCombatProfile = {
  move: PlayerState["move"];
  skills: UnitSkills;
  status: Status;
};

export type PlayerState = {
  level: number;
  move: {
    speed: number;
    safeRange: number;
    range: number;
    count: number;
  };
  tablets: TabletSpec.Slot[];
  inventory: Inventory;
};

export function derivePlayerCombatProfile(
  game: GameData,
  state: PlayerState,
): PlayerCombatProfile {
  const player: PlayerCombatProfile = {
    move: { ...state.move },
    skills: {},
    status: Status.apply(game.playerDefinition.baseStatus, []),
  };
  const tablets = state.tablets.map((tablet, id) =>
    TabletSpec.buildTablet(game, tablet, {
      gameData: game,
      slots: state.tablets,
      id,
      rotate: tablet?.rotate ?? 0,
    }),
  );
  tabletRun(tablets, player);
  return player;
}
