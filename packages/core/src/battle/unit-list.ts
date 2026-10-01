import type { Unit } from "./unit.js";
import type { RandomGenerator } from "./random-generator.js";
import type { Faction } from "./battle.js";
export class UnitList implements Iterable<Unit> {
  private rng: RandomGenerator;
  private units: Unit[];
  constructor(rng: RandomGenerator, units: readonly Unit[] = []) {
    this.units = [...units];
    this.rng = rng;
  }

  [Symbol.iterator](): IterableIterator<Unit> {
    return this.units[Symbol.iterator]();
  }

  add(unit: Unit): void {
    this.units.push(unit);
  }

  remove(unit: Unit): void {
    const index = this.units.indexOf(unit);
    if (index !== -1) this.units.splice(index, 1);
  }

  randomChoice(): Unit | undefined {
    return this.rng.choice(this.units);
  }

  randomChoices(count: number): UnitList {
    return new UnitList(this.rng, this.rng.choices(this.units, count));
  }

  filter(predicate: (unit: Unit) => boolean): UnitList {
    return new UnitList(this.rng, this.units.filter(predicate));
  }

  /** Includes units at both range boundaries. */
  inPositionRange(min: number, max: number): UnitList {
    return this.filter((unit) => unit.position >= min && unit.position <= max);
  }

  ofFaction(faction: Faction): UnitList {
    return this.filter((unit) => unit.faction === faction);
  }
}
