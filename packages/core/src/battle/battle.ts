import { RandomGenerator } from "./random-generator.js";
import { spawn } from "./spawn.js";
import { UnitManager } from "./unit-list.js";
import type { Unit } from "./unit.js";
import { TaskScheduler } from "./task-scheduler.js";
import { PlayerUnit } from "./player-unit.js";
import type { BattleLog, BattleStatus } from "./battle-log.js";
import { EventManager } from "./event-manager.js";
import type { PlayerBuild } from "../player-build.js";
import type { GameData } from "../game-data.js";

export type Faction = "Ally" | "Enemy";
export const Faction = {
  opponent: { Ally: "Enemy", Enemy: "Ally" } satisfies Record<Faction, Faction>,
  getOpponent(faction: Faction): Faction {
    return Faction.opponent[faction];
  },
};

export type BattleSpec = {
  seed: number;
  map: string;
};
export type BattleContext = {
  gameData: GameData;
  build: PlayerBuild;
  spec: BattleSpec;
  rng: RandomGenerator;
  frame: number;
  status: BattleStatus;
  player: PlayerUnit;
  units: UnitManager;
  pendingSpawns: Unit[];
  taskScheduler: TaskScheduler;
  events: EventManager;
};

export class Battle {
  private ctx: BattleContext;
  private buildLog: Record<number, PlayerBuild>;
  constructor(
    gameData: GameData,
    spec: BattleSpec,
    build: PlayerBuild | Record<number, PlayerBuild>,
  ) {
    this.buildLog = structuredClone("level" in build ? { 0: build } : build);
    const initialBuild = this.buildLog[0];
    if (!initialBuild)
      throw new Error("buildLog must include an initial build at frame 0");
    const rng = new RandomGenerator(spec.seed);
    const spawns = spawn(gameData, spec.map, rng);
    const player = new PlayerUnit();
    this.ctx = {
      gameData: gameData,
      build: structuredClone(initialBuild),
      spec: spec,
      rng: rng,
      frame: 0,
      status: "Running",
      player: player,
      units: new UnitManager(rng, [player]),
      pendingSpawns: spawns,
      taskScheduler: new TaskScheduler(),
      events: new EventManager(gameData),
    };
    player.onBuildChanged(this.ctx);
  }
  changeBuild(build: PlayerBuild): void {
    if (this.ctx.status !== "Running") return;
    this.buildLog[this.ctx.frame + 1] = structuredClone(build);
  }
  executeFrame(): BattleLog {
    if (this.ctx.status !== "Running") return this.renderLog();
    this.ctx.frame += 1;
    this.ctx.events.clear();
    const build = this.buildLog[this.ctx.frame];
    if (build) {
      this.ctx.build = structuredClone(build);
      this.ctx.player.onBuildChanged(this.ctx);
    }
    this.spawn();
    for (const unit of this.ctx.units) {
      unit.updateStatus(this.ctx);
    }
    this.ctx.taskScheduler.executeFrame(this.ctx.frame);
    for (const unit of this.ctx.units) {
      unit.onMove(this.ctx);
    }
    for (const unit of this.ctx.units) {
      unit.onUpdate(this.ctx);
    }
    this.fixPosition();
    this.checkDeath();
    this.checkBattleStatus();
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
        hp: unit.hp,
        status: { ...unit.rawStatus },
      })),
      events: this.ctx.events.getEvents(),
    };
  }
  fixPosition(): void {
    const min = this.ctx.player.position;
    const max = min + this.ctx.gameData.config.map.visionRange;
    for (const unit of this.ctx.units) {
      unit.position = Math.max(min, Math.min(max, unit.position));
    }
  }
  spawn(): void {
    const { player, units, gameData } = this.ctx;
    const visionRange = gameData.config.map.visionRange;
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
  checkDeath(): void {
    for (const unit of [...this.ctx.units]) {
      if (unit.hp <= 0) {
        if (!unit.isDead) {
          unit.isDead = true;
          unit.onDeath(this.ctx);
        }
        this.ctx.units.remove(unit);
      }
    }
  }
  checkBattleStatus(): void {
    if (this.ctx.status !== "Running") return;
    if (this.ctx.player.hp <= 0) {
      this.ctx.status = "Defeat";
      return;
    }
    for (const unit of this.ctx.units) {
      if (unit.faction === "Enemy" && unit.hp > 0) return;
    }
    if (this.ctx.pendingSpawns.some((unit) => unit.faction === "Enemy")) return;
    this.ctx.status = "Victory";
  }
}
