import type { Context } from "../context.js";
import { RandomGenerator } from "./random-generator.js";
import { spawn } from "./spawn.js";
import type { Unit } from "./unit.js";

export type Faction = "Ally" | "Enemy";
export const Faction = {
  opponent: { Ally: "Enemy", Enemy: "Ally" } satisfies Record<Faction, Faction>,
  getOpponent(faction: Faction): Faction {
    return Faction.opponent[faction];
  },
};

export type BattleLog = {};
export type BattleSpec = {
  seed: number;
  map: string;
};
export type BattleContext = {
  getUnits: () => Unit[];
  getRandomUnits: (
    position?: { min: number; max: number },
    faction?: Faction,
    count?: number,
  ) => Unit[];
};

export class Battle {
  private context: Context;
  private spec: BattleSpec;
  private rng: RandomGenerator;
  private pendingSpawns: Unit[];
  private activatedUnits: Unit[];
  constructor(ctx: Context, spec: BattleSpec) {
    this.context = ctx;
    this.spec = spec;
    this.rng = new RandomGenerator(spec.seed);
    this.pendingSpawns = spawn(ctx, spec.map, this.rng);
    this.activatedUnits = [];
  }
}
