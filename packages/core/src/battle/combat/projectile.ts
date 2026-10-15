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
    maxFrame: number;
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
    const range =
      arg.speed === undefined ? Infinity : arg.speed * arg.maxFrame * 0.9;
    const position = arg.from.position;
    return arg.ctx.units
      .inPositionRange(position - range, position + range)
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
    const direction = Math.sign(state.to.position - position);
    for (let i: number = 0; i < state.maxFrame; i++) {
      yield* TaskScheduler.waitFrames(1);
      if (state.to.isDead) return;
      if (direction == 0) {
        hit(state);
        return;
      }
      position += direction * state.speed!;
      if (Math.sign(state.to.position - position) != direction) {
        hit(state);
        return;
      }
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
        maxFrame: state.maxFrame,
      },
    });
    if (state.speed == undefined) {
      hit(state);
      return;
    }
    state.ctx.taskScheduler.start(run(state));
  }
  export function fire(arg: Arg): void {
    if (arg.source.isDead || arg.from.isDead) return;
    for (const target of searchTarget(arg, 1)) {
      submit({
        ...arg,
        to: target,
        hitUnit: [],
      });
    }
  }
}
