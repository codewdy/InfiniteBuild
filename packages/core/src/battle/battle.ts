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
  units: {
    id: number;
    kind: string;
    position: number;
  }[];
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
    const rng = new RandomGenerator(spec.seed);
    const spawns = spawn(ctx, spec.map, rng);
    const player = new PlayerUnit();
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
    this.spawn();
    this.ctx.taskScheduler.executeFrame(this.ctx.frame);
    for (const unit of this.ctx.units) {
      unit.move(this.ctx);
    }
    for (const unit of this.ctx.units) {
      unit.onUpdate(this.ctx);
    }
    this.fixPosition();
    return this.renderLog();
  }
  renderLog(): BattleLog {
    return {
      frame: this.ctx.frame,
      status: this.ctx.status,
      units: Array.from(this.ctx.units, (unit) => ({
        id: unit.id,
        kind: unit.kind,
        position: unit.position,
      })),
    };
  }
  fixPosition(): void {
    const min = this.ctx.player.position;
    const max = min + this.ctx.ctx.gameData.config.map.visionRange;
    for (const unit of this.ctx.units) {
      unit.position = Math.max(min, Math.min(max, unit.position));
    }
  }
  spawn(): void {
    const { player, units, ctx } = this.ctx;
    const visionRange = ctx.gameData.config.map.visionRange;
    const pendingSpawns: Unit[] = [];
    for (const unit of this.ctx.pendingSpawns) {
      if (Math.abs(unit.position - player.position) <= visionRange) {
        units.add(unit);
      } else {
        pendingSpawns.push(unit);
      }
    }
    this.ctx.pendingSpawns = pendingSpawns;
  }
}
