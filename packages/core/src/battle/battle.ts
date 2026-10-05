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
import type { PlayerState } from "../player/state.js";
import type { GameData } from "../game-data.js";

export type BattleSpec = {
  seed: number;
  map: string;
};
export type BattleContext = {
  gameData: GameData;
  playerState: PlayerState;
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
  private stateLog: Record<number, PlayerState>;
  constructor(
    gameData: GameData,
    spec: BattleSpec,
    state: PlayerState | Record<number, PlayerState>,
  ) {
    const stateLog = "build" in state ? { 0: state } : state;
    this.stateLog = Object.fromEntries(
      Object.entries(stateLog).map(([frame, entry]) => [
        frame,
        structuredClone(entry),
      ]),
    );
    const initialState = this.stateLog[0];
    if (!initialState)
      throw new Error("stateLog must include an initial state at frame 0");
    const rng = new RandomGenerator(spec.seed);
    const spawns = spawn(gameData, spec.map, rng);
    const player = new PlayerUnit();
    for (const unit of [player, ...spawns]) {
      unit.buffs = new BuffManager(gameData.buffDefinitions);
    }
    this.ctx = {
      gameData: gameData,
      playerState: structuredClone(initialState),
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
  changeState(state: PlayerState): void {
    if (this.ctx.status !== "Running") return;
    this.stateLog[this.ctx.frame + 1] = structuredClone(state);
  }
  executeFrame(): BattleLog {
    if (this.ctx.status !== "Running") return this.renderLog();
    this.ctx.frame += 1;
    this.ctx.events.clear();
    const state = this.stateLog[this.ctx.frame];
    if (state) {
      this.ctx.playerState = structuredClone(state);
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
