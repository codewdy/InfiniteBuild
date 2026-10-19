import { Position } from "../position.js";
import type { BattleContext } from "../battle.js";
import { TaskScheduler } from "../task-scheduler.js";
import type { UnitList } from "../unit-list.js";
import type { Unit } from "./unit.js";

export namespace Projectile {
  export type Arg = {
    ctx: BattleContext;
    source: Unit;
    from: Unit;
    speed?: number;
    range: number;
    effect: string;
    onHit: (unit: Unit) => void;
    bounce: number;
  };
  export type State = Arg & {
    to: Unit;
    hitUnit: Unit[];
  };
  function searchTarget(
    arg: Arg & { hitUnit?: Unit[] },
    count: number,
  ): UnitList {
    const position = arg.from.position;
    return arg.ctx.units
      .inPositionRange(position, arg.range)
      .filter(
        (unit) =>
          unit.faction !== arg.source.faction &&
          !unit.isDead &&
          !(arg.hitUnit ?? []).includes(unit),
      )
      .randomChoices(count);
  }
  function hit(state: State) {
    const target = state.to;
    if (target.isDead) return;
    state.hitUnit.push(target);
    state.onHit(target);
    if (state.bounce <= 1) return;

    for (const nextTarget of searchTarget({ ...state, from: target }, 1)) {
      submit({
        ...state,
        from: target,
        to: nextTarget,
        bounce: state.bounce - 1,
      });
    }
  }
  function* run(state: State): TaskScheduler.Routine {
    let position = state.from.position;

    const duration = state.range / (state.speed ?? 1) + 2;
    for (let i: number = 0; i < duration; i++) {
      yield* TaskScheduler.waitFrames(1);
      if (state.to.isDead) return;
      const distance = Position.distance(position, state.to.position);
      if (distance <= state.speed!) {
        hit(state);
        return;
      }
      position = Position.translate(
        position,
        Position.direction(position, state.to.position),
        state.speed!,
      );
    }
  }
  function submit(state: State) {
    state.ctx.events.addEffect({
      effect: state.effect,
      source: state.source.id,
      skill: state.effect,
      payload: {
        from: state.from.id,
        to: state.to.id,
        projectileSpeed: state.speed,
        maxFrame: state.speed == undefined ? 0 : state.range / state.speed + 2,
      },
    });
    if (state.speed == undefined) {
      hit(state);
      return;
    }
    state.ctx.taskScheduler.start(run(state));
  }
  export function fire(states: State[]): void {
    for (const state of states) {
      submit(state);
    }
  }
  export function prepare(arg: Arg): State[] {
    if (arg.source.isDead) return [];
    return Array.from(searchTarget(arg, 1), (target) => ({
      ...arg,
      to: target,
      hitUnit: [],
    }));
  }
}
