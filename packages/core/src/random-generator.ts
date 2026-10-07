export class RandomGenerator {
  private state: number;

  /** Seeds are normalized to unsigned 32-bit integers. */
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError("seed must be a safe integer");
    }
    this.state = seed >>> 0;
  }

  /** Returns a reproducible random number in [0, 1) using Mulberry32. */
  rand(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  /** Returns an integer in [min, max]; the range may contain at most 2^32 values. */
  randInt(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError("min and max must be safe integers with min <= max");
    }

    const range = max - min + 1;
    if (range > 0x100000000) {
      throw new RangeError("integer range must contain at most 2^32 values");
    }

    // Reject the incomplete bucket to avoid modulo bias.
    const limit = 0x100000000 - (0x100000000 % range);
    let value: number;
    do {
      value = this.rand() * 0x100000000;
    } while (value >= limit);
    return min + (value % range);
  }
  /** Returns an equally likely array element, or undefined for an empty array. */
  choice<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.randInt(0, items.length - 1)];
  }

  /**
   * Selects up to count elements without replacement, in random order.
   * Leaves the input unchanged; duplicate values at different indices remain distinct.
   */
  choices<T>(items: readonly T[], count: number): T[] {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError("count must be a non-negative safe integer");
    }
    const size = Math.min(count, items.length);
    if (size === 0) return [];

    const pool = [...items];
    // Partial Fisher–Yates gives each ordered selection equal probability.
    for (let i = 0; i < size; i++) {
      const index = this.randInt(i, pool.length - 1);
      const selected = pool[index]!;
      pool[index] = pool[i]!;
      pool[i] = selected;
    }
    return pool.slice(0, size);
  }

  /** Returns an index sampled in proportion to non-negative weights. */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (
      !Number.isFinite(total) ||
      total <= 0 ||
      weights.some((weight) => weight < 0)
    ) {
      throw new Error("Invalid random weights.");
    }
    let value = this.rand() * total;
    let last = 0;
    for (const [index, weight] of weights.entries()) {
      if (weight > 0) last = index;
      if (value < weight) return index;
      value -= weight;
    }
    return last;
  }

  /** Returns a uniformly distributed number between min and max. */
  uniform(min: number, max: number): number {
    this.validateRange(min, max);
    if (min === max) return min;
    const weight = this.rand();
    return Math.max(min, Math.min(max, min * (1 - weight) + max * weight));
  }

  /**
   * Samples a normal distribution with mean at the range midpoint and
   * sigma = (max - min) / 4. Values beyond ±2 sigma are clamped to the
   * boundaries (approximately 2.275% probability at each boundary).
   */
  truncatedNorm(min: number, max: number): number {
    this.validateRange(min, max);
    if (min === max) return min;

    // Box–Muller: 1 - rand() keeps the logarithm's argument above zero.
    const standardNormal =
      Math.sqrt(-2 * Math.log(1 - this.rand())) *
      Math.cos(2 * Math.PI * this.rand());
    if (standardNormal <= -2) return min;
    if (standardNormal >= 2) return max;

    const weight = 0.5 + standardNormal / 4;
    return Math.max(min, Math.min(max, min * (1 - weight) + max * weight));
  }

  private validateRange(min: number, max: number): void {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new RangeError(
        "min and max must be finite numbers with min <= max",
      );
    }
  }
}
