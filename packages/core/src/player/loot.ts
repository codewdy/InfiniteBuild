import type { RandomGenerator } from "../random-generator.js";
import { Affix } from "./affix.js";
import type { TabletSpec } from "./tablet/spec.js";
import type { GameData } from "../game-data.js";
import type { Item } from "./item/item.js";
import type { PlayerState } from "./state.js";

export namespace Loot {
  export type Kind = Item["kind"];
  export type Definition = {
    min: number;
    max: number;
    pool: {
      kind: Loot.Kind;
      rarity: Item.Rarity;
      weight: number;
    }[];
  };
  export type LootItem = {
    kind: Kind;
    rarity: Item.Rarity;
    level: number;
  };
  export const rarityAffixCount: Record<
    Item.Rarity,
    readonly [number, number]
  > = {
    normal: [0, 0],
    magic: [1, 2],
    rare: [3, 4],
  };
  export function generateLoot(
    data: GameData,
    rng: RandomGenerator,
    loot: LootItem,
  ): Item {
    const uuid = crypto.randomUUID();
    const base: Item.ItemBase = {
      uuid,
      rarity: loot.rarity,
      affixes: [],
    };
    let tablet: TabletSpec.Tablet;
    switch (loot.kind) {
      case "tablet-skill": {
        const skill = rng.choice(Object.keys(data.playerDefinition.skills));
        if (skill === undefined) {
          throw new Error("No player skills available for loot.");
        }
        tablet = { ...base, kind: "tablet-skill", skill };
        break;
      }
      case "tablet-passive":
        tablet = {
          ...base,
          kind: "tablet-passive",
          affixes: Affix.rollAffixes(
            rng,
            data.affixDefinition.tablet.passive,
            [loot.kind],
            loot.level,
            rng.randInt(...rarityAffixCount[loot.rarity]),
          ),
        };
        break;
      case "tablet-support-skill":
      case "tablet-support-passive": {
        const targetSelection = rng.choice(
          data.playerDefinition.tablet.targetSelection,
        );
        if (targetSelection === undefined) {
          throw new Error("No tablet target selections available for loot.");
        }
        tablet = {
          ...base,
          kind: loot.kind,
          rotate: 0,
          targetSelection: targetSelection.id,
          affixes: Affix.rollAffixes(
            rng,
            data.affixDefinition.tablet.support,
            [loot.kind],
            loot.level,
            rng.randInt(...rarityAffixCount[loot.rarity]),
          ),
        };
        break;
      }
      default:
        throw new Error(`Unknown loot kind: ${loot.kind}`);
    }
    return tablet;
  }

  export function generateLoots(
    data: GameData,
    rng: RandomGenerator,
    player: PlayerState,
  ): LootItem[] {
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
      return { kind: entry.kind, level: player.level, rarity: entry.rarity };
    });
  }
}
