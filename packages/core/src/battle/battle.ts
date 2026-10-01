import type { Context } from "../context.js";
import { RandomGenerator } from "./random-generator.js";
import { spawn } from "./spawn.js";
import { UnitManager } from "./unit-list.js";
import type { Unit } from "./unit.js";
import { TaskScheduler } from "./task-scheduler.js";
import { PlayerUnit } from "./player-unit.js";

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
  player: PlayerUnit;
  units: UnitManager;
  pendingSpawns: Unit[];
  taskScheduler: TaskScheduler;
};

export class Battle {
  private ctx: BattleContext;
  constructor(ctx: Context, spec: BattleSpec) {
    let rng = new RandomGenerator(spec.seed);
    let spawns = spawn(ctx, spec.map, rng);
    let player = new PlayerUnit();
    this.ctx = {
      ctx: ctx,
      spec: spec,
      rng: rng,
      frame: 0,
      status: "Running",
      player: player,
      units: new UnitManager(rng, [player]),
      pendingSpawns: spawns,
      taskScheduler: new TaskScheduler(),
    };
  }
  executeFrame(): BattleLog {
    this.ctx.frame += 1;
    this.ctx.taskScheduler.executeFrame(this.ctx.frame);
    for (let unit of this.ctx.units) {
      unit.onUpdate(this.ctx);
    }
    return this.renderLog();
  }
  renderLog(): BattleLog {
    return {
      frame: this.ctx.frame,
      status: this.ctx.status,
    };
  }
}
