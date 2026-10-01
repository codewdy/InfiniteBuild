import type { Context } from "../context.js";
import { RandomGenerator } from "./random-generator.js";
import { spawn } from "./spawn.js";
import { UnitList } from "./unit-list.js";
import type { Unit } from "./unit.js";

export type Faction = "Ally" | "Enemy";
export const Faction = {
  opponent: { Ally: "Enemy", Enemy: "Ally" } satisfies Record<Faction, Faction>,
  getOpponent(faction: Faction): Faction {
    return Faction.opponent[faction];
  },
};

export type BattleStatus = "Running" | "Victory" | "Defeat";
export type BattleLog = {
  frame: number;
  status: BattleStatus;
};
export type BattleSpec = {
  seed: number;
  map: string;
};
export type BattleContext = {
  ctx: Context;
  spec: BattleSpec;
  rng: RandomGenerator;
  frame: number;
  status: BattleStatus;
  units: UnitList;
  pendingSpawns: Unit[];
};

export class Battle {
  private ctx: BattleContext;
  constructor(ctx: Context, spec: BattleSpec) {
    var rng = new RandomGenerator(spec.seed);
    var spawns = spawn(ctx, spec.map, rng);
    this.ctx = {
      ctx: ctx,
      spec: spec,
      rng: rng,
      frame: 0,
      status: "Running",
      units: new UnitList(rng, []),
      pendingSpawns: spawns,
    };
  }
  executeFrame(): BattleLog {
    this.ctx.frame += 1;
    return this.renderLog();
  }
  renderLog(): BattleLog {
    return {
      frame: this.ctx.frame,
      status: this.ctx.status,
    };
  }
}
