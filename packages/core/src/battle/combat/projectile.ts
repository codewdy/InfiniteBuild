import type { BattleContext } from "../battle.js";
import { TaskScheduler } from "../task-scheduler.js";
import type { Unit } from "./unit.js";

export namespace Projectile {
  export type State = {
    ctx: BattleContext;
    unit: Unit;
    start: number;
    speed?: number;
    maxFrame: number;
    onSubmit: (start: number, unit: Unit) => void;
    onHit: (unit: Unit) => void;
    bounce: number;
    hitUnit: Unit[];
  };
  function hit(state: State) {
    const target = state.unit;
    if (target.isDead) return;
    const position = target.position;
    state.hitUnit.push(target);
    state.onHit(target);
    if (state.bounce <= 1) return;

    const range =
      state.speed === undefined ? Infinity : state.speed * state.maxFrame * 0.9;
    const nextTarget = state.ctx.units
      .ofFaction(target.faction)
      .inPositionRange(position - range, position + range)
      .filter((unit) => !unit.isDead && !state.hitUnit.includes(unit))
      .randomChoice();
    if (!nextTarget) return;
    submit({
      ...state,
      unit: nextTarget,
      start: position,
      bounce: state.bounce - 1,
    });
  }
  export function* run(state: State): TaskScheduler.Routine {
    let position = state.start;
    const direction = Math.sign(state.unit.position - position);
    for (let i: number = 0; i < state.maxFrame; i++) {
      yield* TaskScheduler.waitFrames(1);
      if (state.unit.isDead) return;
      if (direction == 0) {
        hit(state);
        return;
      }
      position += direction * state.speed!;
      if (Math.sign(state.unit.position - position) != direction) {
        hit(state);
        return;
      }
    }
  }
  export function submit(state: State) {
    state.onSubmit(state.start, state.unit);
    if (state.speed == undefined) {
      hit(state);
      return;
    }
    state.ctx.taskScheduler.start(run(state));
  }
}
