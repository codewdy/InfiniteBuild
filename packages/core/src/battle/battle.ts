import { BuffManager } from "./combat/buff.js";
import { RandomGenerator } from "./random-generator.js";
import { spawn } from "./spawn.js";
import { UnitManager } from "./unit-list.js";
import type { Unit } from "./combat/unit.js";
import { TaskScheduler } from "./task-scheduler.js";
import { PlayerUnit } from "./combat/player-unit.js";
import type { BattleLog, BattleStatus } from "./battle-log.js";
import { EventManager } from "./event-manager.js";
import { spawnUnits, fixPosition } from "./combat/movement.js";
import { updateStatus, resolveDeath } from "./combat/unit-status.js";
import type { PlayerBuild } from "../player/build.js";
import type { GameData } from "../game-data.js";

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

function cloneBuild(build: PlayerBuild): PlayerBuild {
  const { tablets, ...data } = build;
  // 石板包含方法，不能 structuredClone；复制槽位数组并保留石板实例。
  return { ...structuredClone(data), tablets: [...tablets] };
}

export class Battle {
  private ctx: BattleContext;
  private buildLog: Record<number, PlayerBuild>;
  constructor(
    gameData: GameData,
    spec: BattleSpec,
    build: PlayerBuild | Record<number, PlayerBuild>,
  ) {
    const buildLog = "level" in build ? { 0: build } : build;
    this.buildLog = Object.fromEntries(
      Object.entries(buildLog).map(([frame, entry]) => [
        frame,
        cloneBuild(entry),
      ]),
    );
    const initialBuild = this.buildLog[0];
    if (!initialBuild)
      throw new Error("buildLog must include an initial build at frame 0");
    const rng = new RandomGenerator(spec.seed);
    const spawns = spawn(gameData, spec.map, rng);
    const player = new PlayerUnit();
    for (const unit of [player, ...spawns]) {
      unit.buffs = new BuffManager(gameData.buffDefinitions);
    }
    this.ctx = {
      gameData: gameData,
      build: cloneBuild(initialBuild),
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
    this.buildLog[this.ctx.frame + 1] = cloneBuild(build);
  }
  executeFrame(): BattleLog {
    if (this.ctx.status !== "Running") return this.renderLog();
    this.ctx.frame += 1;
    this.ctx.events.clear();
    const build = this.buildLog[this.ctx.frame];
    if (build) {
      this.ctx.build = cloneBuild(build);
      this.ctx.player.onBuildChanged(this.ctx);
    }
    spawnUnits(this.ctx);
    for (const unit of this.ctx.units) {
      updateStatus(this.ctx, unit);
    }
    this.ctx.taskScheduler.executeFrame(this.ctx.frame);
    for (const unit of this.ctx.units) {
      unit.onMove(this.ctx);
    }
    for (const unit of this.ctx.units) {
      unit.onUpdate(this.ctx);
    }
    fixPosition(this.ctx);
    resolveDeath(this.ctx);
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
        status: {
          attributes: { ...unit.rawStatus.attributes },
          tags: [...unit.rawStatus.tags],
        },
      })),
      events: this.ctx.events.getEvents(),
    };
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
