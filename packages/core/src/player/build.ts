import type { GameData } from "../game-data.js";
import { SkillTablet } from "./tablet/skill-tablet.js";
import type { UnitSkills } from "../battle/combat/skill-trigger.js";
import { Status } from "../battle/combat/status.js";
import { tabletRun } from "./tablet/tablet-runner.js";
import type { Tablet } from "./tablet/tablet.js";

export namespace PlayerBuild {
  export type EmptyTablet = {
    kind: "empty";
  };
  export type SkillTablet = {
    kind: "skill";
    uuid: string;
    skill: string;
  };
  export type Tablet = EmptyTablet | SkillTablet;
}

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
  tablets: PlayerBuild.Tablet[];
};

function buildTablet(
  game: GameData,
  tablet: PlayerBuild.Tablet,
): Tablet | undefined {
  switch (tablet.kind) {
    case "empty":
      return undefined;
    case "skill": {
      const skill = game.playerDefinition.skills[tablet.skill];
      if (!skill) throw new Error(`Unknown player skill: ${tablet.skill}`);
      return new SkillTablet(tablet.uuid, skill);
    }
    default:
      throw new Error(
        `Unknown tablet kind: ${(tablet as { kind: string }).kind}`,
      );
  }
}

export function inferPlayerStatus(
  game: GameData,
  build: PlayerBuild,
): PlayerStatus {
  const player: PlayerStatus = {
    skills: {},
    status: Status.apply(game.playerDefinition.baseStatus, []),
  };
  const tablets = build.tablets.map((tablet) => buildTablet(game, tablet));
  tabletRun(tablets, player);
  return player;
}
