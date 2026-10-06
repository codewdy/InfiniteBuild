import type { GameData } from "../../game-data.js";
import type { Affix } from "../affix.js";
import type { TabletMap } from "./map.js";
import { SkillTablet } from "./skill.js";
import { PassiveTablet } from "./passive.js";
import { SupportTablet } from "./support.js";
import type { Tablet as RuntimeTablet } from "./tablet.js";

export namespace TabletSpec {
  export type Skill = {
    kind: "skill";
    uuid: string;
    rotate: TabletMap.Rotate;
    skill: string;
  };
  export type SupportSkill = {
    kind: "support-skill";
    uuid: string;
    rotate: TabletMap.Rotate;
    delta: SupportTablet.Delta[];
    affixes: Affix.Spec[];
  };
  export type SupportPassive = {
    kind: "support-passive";
    uuid: string;
    rotate: TabletMap.Rotate;
    delta: SupportTablet.Delta[];
    affixes: Affix.Spec[];
  };
  export type Passive = {
    kind: "passive";
    uuid: string;
    rotate: TabletMap.Rotate;
    affixes: Affix.Spec[];
  };
  export type Tablet = Skill | Passive | SupportSkill | SupportPassive;
  export type Slot = Tablet | null;

  export function buildTablet(
    game: GameData,
    tablet: Slot,
    ctx: RuntimeTablet.Context,
  ): RuntimeTablet | undefined {
    if (tablet === null) return undefined;
    switch (tablet.kind) {
      case "skill": {
        const skill = game.playerDefinition.skills[tablet.skill];
        if (!skill) throw new Error(`Unknown player skill: ${tablet.skill}`);
        return new SkillTablet(ctx, tablet.uuid, skill);
      }
      case "support-skill":
        return new SupportTablet(ctx, tablet.delta, "skill", tablet.affixes);
      case "passive":
        return new PassiveTablet(ctx, tablet.affixes);
      case "support-passive":
        return new SupportTablet(ctx, tablet.delta, "passive", tablet.affixes);
      default:
        throw new Error(
          `Unknown tablet kind: ${(tablet as { kind: string }).kind}`,
        );
    }
  }
}
