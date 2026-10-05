import type { GameData } from "../../game-data.js";
import { SkillTablet } from "./skill.js";
import type { Tablet as RuntimeTablet } from "./tablet.js";

export namespace TabletSpec {
  export type Skill = {
    kind: "skill";
    uuid: string;
    skill: string;
  };
  export type Tablet = Skill;
  export type Slot = Tablet | null;

  export function buildTablet(
    game: GameData,
    tablet: Slot,
  ): RuntimeTablet | undefined {
    if (tablet === null) return undefined;
    switch (tablet.kind) {
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
}
