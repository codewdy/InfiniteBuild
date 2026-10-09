import type { GameData } from "../../game-data.js";
import type { TabletMap } from "./map.js";
import { SkillTablet } from "./skill.js";
import { PassiveTablet } from "./passive.js";
import { SupportTablet } from "./support.js";
import type { Tablet as RuntimeTablet } from "./tablet.js";
import type { Item } from "../item/item.js";

export namespace TabletSpec {
  export type Skill = Item.ItemBase & {
    kind: "tablet-skill";
    skill: string;
  };
  export type Support = Item.ItemBase & {
    rotate: TabletMap.Rotate;
    targetSelection: string;
  };
  export type SupportSkill = Support & {
    kind: "tablet-support-skill";
  };
  export type SupportPassive = Support & {
    kind: "tablet-support-passive";
  };
  export type Passive = Item.ItemBase & {
    kind: "tablet-passive";
  };
  export type Tablet = Skill | Passive | SupportSkill | SupportPassive;
  export type Slot = Tablet | null;
  export const kind = [
    "tablet-skill",
    "tablet-support-skill",
    "tablet-support-passive",
    "tablet-passive",
  ];

  export function getSupportDelta(
    game: GameData,
    tablet: Support,
  ): SupportTablet.Delta {
    const selection =
      game.playerDefinition.tablet.targetSelection[tablet.targetSelection];
    if (!selection) {
      throw new Error(
        `Unknown tablet target selection: ${tablet.targetSelection}`,
      );
    }
    return selection.delta;
  }

  export function buildTablet(
    game: GameData,
    tablet: Slot,
    context: Omit<RuntimeTablet.Context, "rotate">,
  ): RuntimeTablet | undefined {
    if (tablet === null) return undefined;
    const ctx: RuntimeTablet.Context = {
      ...context,
      rotate: "rotate" in tablet ? tablet.rotate : 0,
    };
    switch (tablet.kind) {
      case "tablet-skill": {
        const skill = game.playerDefinition.skills[tablet.skill];
        if (!skill) throw new Error(`Unknown player skill: ${tablet.skill}`);
        return new SkillTablet(ctx, tablet.uuid, skill);
      }
      case "tablet-support-skill":
        return new SupportTablet(
          ctx,
          [getSupportDelta(game, tablet)],
          "tablet-skill",
          tablet.affixes,
        );
      case "tablet-passive":
        return new PassiveTablet(ctx, tablet.affixes);
      case "tablet-support-passive":
        return new SupportTablet(
          ctx,
          [getSupportDelta(game, tablet)],
          "tablet-passive",
          tablet.affixes,
        );
      default:
        throw new Error(
          `Unknown tablet kind: ${(tablet as { kind: string }).kind}`,
        );
    }
  }
}
