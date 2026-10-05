import type { GameData } from "../game-data.js";
import { TabletSpec } from "./tablet/spec.js";
import type { UnitSkills } from "../battle/combat/skill-trigger.js";
import { Status } from "../battle/combat/status.js";
import { tabletRun } from "./tablet/runner.js";

export type PlayerStatus = {
  skills: UnitSkills;
  status: Status;
};

export type PlayerBuild = {
  level: number;
  move: {
    speed: number;
    safeRange: number;
    range: number;
    count: number;
  };
  tablets: TabletSpec.Slot[];
};

export function inferPlayerStatus(
  game: GameData,
  build: PlayerBuild,
): PlayerStatus {
  const player: PlayerStatus = {
    skills: {},
    status: Status.apply(game.playerDefinition.baseStatus, []),
  };
  const tablets = build.tablets.map((tablet) =>
    TabletSpec.buildTablet(game, tablet),
  );
  tabletRun(tablets, player);
  return player;
}
