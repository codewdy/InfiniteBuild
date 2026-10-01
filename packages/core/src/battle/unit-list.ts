import type { Unit } from "./unit.js";
import type { RandomGenerator } from "./random-generator.js";
import type { Faction } from "./battle.js";
export class UnitList implements Iterable<Unit> {
  protected rng: RandomGenerator;
  protected units: Unit[];
  constructor(rng: RandomGenerator, units: readonly Unit[] = []) {
    this.units = [...units];
    this.rng = rng;
  }

  [Symbol.iterator](): IterableIterator<Unit> {
    return this.units[Symbol.iterator]();
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

export class UnitManager extends UnitList {
  private unitId: number = 0;

  constructor(rng: RandomGenerator, units: readonly Unit[] = []) {
    super(rng);
    for (const unit of units) this.add(unit);
  }

  /** Assigns a new ID; IDs are never reused after removal. */
  add(unit: Unit): void {
    if (this.units.includes(unit)) return;
    this.unitId += 1;
    unit.id = this.unitId;
    this.units.push(unit);
  }

  remove(unit: Unit): void {
    const index = this.units.indexOf(unit);
    if (index !== -1) this.units.splice(index, 1);
  }
}
