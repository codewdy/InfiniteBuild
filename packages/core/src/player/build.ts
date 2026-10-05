import type { UnitSkills } from "../battle/combat/skill-trigger.js";
import { Status } from "../battle/combat/status.js";
import { tabletRun } from "./tablet/tablet-runner.js";
import type { Tablet } from "./tablet/tablet.js";

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
  // TODO: tablet 管理
  tablets: (Tablet | undefined)[];
};

export function inferPlayerStatus(build: PlayerBuild): PlayerStatus {
  const player: PlayerStatus = {
    skills: {},
    status: Status.createByConfig({ attributes: { maxHp: 10 } }),
  };
  tabletRun(build.tablets, player);
  return player;
}
