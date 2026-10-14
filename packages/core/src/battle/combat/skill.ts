import type { BattleContext } from "../battle.js";
import { TaskScheduler } from "../task-scheduler.js";
import type { Unit } from "./unit.js";
import type { Status } from "./status.js";
import type { SkillTrigger } from "./skill-trigger.js";

export namespace Skill {
  export type SkillReady = { kind: "SkillReady" };

  export const waitFrames = TaskScheduler.waitFrames;
  export function* ready(): Generator<SkillReady, void, void> {
    yield { kind: "SkillReady" };
  }

  export type Routine = Generator<
    SkillReady | TaskScheduler.Suspension,
    void,
    void
  >;

  export type Caster = (
    ctx: BattleContext,
    unit: Unit,
    skill: Context,
  ) => Routine;
  export type Params = Record<string, unknown>;

  export type Definition = {
    name: string;
    description: (params: Params) => string;
    caster: Caster;
  };

  export type Context = {
    uuid: string;
    skill: string;
    caster: Caster;
    castRate?: number;
    battleContext: BattleContext;
    params: Params;
    status: Status;
    rawStatus: Status.RawStatus;
    ready: boolean;
  };

  export function cast(
    ctx: BattleContext,
    unit: Unit,
    skill: Context,
    trigger: SkillTrigger.EventType,
  ): void {
    if (!skill.ready) return;
    const caster = skill.caster(ctx, unit, skill);
    const readyInfo = caster.next();
    if (readyInfo.done) {
      skill.ready = false;
      return;
    }
    if (readyInfo.value.kind !== "SkillReady") {
      caster.return();
      throw new Error("skill must yield SkillReady before waiting");
    }
    if (trigger === "onUpdate") {
      ctx.events.addCast({
        source: unit.id,
        skill: skill.skill,
        uuid: skill.uuid,
      });
    }
    ctx.taskScheduler.start(caster as TaskScheduler.Routine);
  }
}
