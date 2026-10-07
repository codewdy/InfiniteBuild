import { RandomGenerator } from "../random-generator.js";
import { Affix } from "./affix.js";
import type { TabletSpec } from "./tablet/spec.js";
import type { GameData } from "../game-data.js";
import type { Item } from "./item/item.js";
import type { PlayerState } from "./state.js";

export namespace Loot {
  export type Kind =
    | "tablet-support-skill"
    | "tablet-support-passive"
    | "tablet-skill"
    | "tablet-passive";
  export type Definition = {
    min: number;
    max: number;
    pool: {
      kind: Loot.Kind;
      weight: number;
    }[];
  };
  export function generateLoot(
    data: GameData,
    rng: RandomGenerator,
    kind: Kind,
    level: number,
  ): Item {
    const uuid = crypto.randomUUID();
    let tablet: TabletSpec.Tablet;
    switch (kind) {
      case "tablet-skill": {
        const skill = rng.choice(Object.keys(data.playerDefinition.skills));
        if (skill === undefined) {
          throw new Error("No player skills available for loot.");
        }
        tablet = { kind: "skill", uuid, rotate: 0, skill };
        break;
      }
      case "tablet-passive":
        tablet = {
          kind: "passive",
          uuid,
          rotate: 0,
          affixes: Affix.rollAffixes(
            rng,
            data.affixDefinition.tablet.passive,
            ["passive"],
            level,
          ),
        };
        break;
      case "tablet-support-skill":
      case "tablet-support-passive": {
        const tabletKind =
          kind === "tablet-support-skill" ? "support-skill" : "support-passive";
        tablet = {
          kind: tabletKind,
          uuid,
          rotate: 0,
          delta: [[1, 0]],
          affixes: Affix.rollAffixes(
            rng,
            data.affixDefinition.tablet.support,
            [tabletKind],
            level,
          ),
        };
        break;
      }
      default:
        throw new Error(`Unknown loot kind: ${kind}`);
    }
    return { kind: "tablet", uuid, tablet };
  }

  export function generateLoots(
    data: GameData,
    rng: RandomGenerator,
    player: PlayerState,
  ): Item[] {
    const { min, max, pool } = data.playerDefinition.loot;
    if (min < 0) {
      throw new RangeError("Minimum loot count must be non-negative.");
    }
    const count = Math.round(rng.uniform(min, max));
    if (!Number.isSafeInteger(count)) {
      throw new RangeError("Loot count must be a safe integer.");
    }
    const weights = pool.map((entry) => entry.weight);
    return Array.from({ length: count }, () => {
      const entry = pool[rng.weightedIndex(weights)]!;
      return generateLoot(data, rng, entry.kind, player.level);
    });
  }
}
