import type { RandomGenerator } from "../random-generator.js";

export namespace Affix {
  export type Tier = {
    min: number;
    max: number;
  };
  export type Definition<T> = {
    name: string;
    description: (param: number) => string;
    apply: T;
    tier: Tier[];
    tag: string[];
  };
  export type Definitions<T> = {
    pool: Record<string, Definition<T>>;
    roll: {
      levelSpread: number;
      tier: {
        weight: number;
        level: number;
      }[];
      countWeight: number[];
    };
  };
  export type RollDefinition = Definitions<unknown>["roll"];
  export type Spec = {
    id: string;
    tier: number;
    param: number;
  };
  export function rollTier(
    rng: RandomGenerator,
    roll: RollDefinition,
    level: number,
  ): number {
    const weights = roll.tier.map((tier) => {
      if (tier.level > level) return 0;
      const distance = (level - tier.level) / roll.levelSpread;
      return tier.weight * Math.exp(-0.5 * distance * distance);
    });
    if (weights.length == 0) {
      return 0;
    }
    return rng.weightedIndex(weights);
  }
  export function rollValue<T>(
    rng: RandomGenerator,
    affix: Definition<T>,
    tier: number,
  ): number {
    const range = affix.tier[tier];
    if (!range) throw new Error(`Unknown affix tier: ${tier}`);
    return rng.uniform(range.min, range.max);
  }
  export function rollAffix<T>(
    rng: RandomGenerator,
    pool: Definitions<T>,
    tags: string[],
    level: number,
  ): Spec {
    const ids = Object.keys(pool.pool).filter((id) =>
      tags.every((tag) => pool.pool[id]!.tag.includes(tag)),
    );
    const id = rng.choice(ids);
    if (id === undefined)
      throw new Error(`No affixes for tags: ${tags.join(", ")}`);
    return rerollTier(rng, pool, level, { id, tier: 0, param: 0 });
  }
  export function rollAffixes<T>(
    rng: RandomGenerator,
    pool: Definitions<T>,
    tags: string[],
    level: number,
    count: number = rng.weightedIndex(pool.roll.countWeight),
  ): Spec[] {
    const ids = Object.keys(pool.pool).filter((id) =>
      tags.every((tag) => pool.pool[id]!.tag.includes(tag)),
    );
    return rng
      .choices(ids, count)
      .map((id) => rerollTier(rng, pool, level, { id, tier: 0, param: 0 }));
  }
  export function rerollValue<T>(
    rng: RandomGenerator,
    pool: Definitions<T>,
    affix: Spec,
  ): Spec {
    const definition = pool.pool[affix.id];
    if (!definition) throw new Error(`Unknown affix: ${affix.id}`);
    return { ...affix, param: rollValue(rng, definition, affix.tier) };
  }
  export function rerollTier<T>(
    rng: RandomGenerator,
    pool: Definitions<T>,
    level: number,
    affix: Spec,
  ): Spec {
    const definition = pool.pool[affix.id];
    if (!definition) throw new Error(`Unknown affix: ${affix.id}`);
    const tier = rollTier(
      rng,
      { ...pool.roll, tier: pool.roll.tier.slice(0, definition.tier.length) },
      level,
    );
    return { ...affix, tier, param: rollValue(rng, definition, tier) };
  }
}
