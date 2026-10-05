import type { GameData } from "../game-data.js";
import { TabletSpec } from "./tablet/spec.js";
import type { UnitSkills } from "../battle/combat/skill-trigger.js";
import { Status } from "../battle/combat/status.js";
import { tabletRun } from "./tablet/runner.js";

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
  const tablets = state.tablets.map((tablet) =>
    TabletSpec.buildTablet(game, tablet),
  );
  tabletRun(tablets, player);
  return player;
}
