import type { BattleContext } from "../battle.js";
import type { Routine } from "../task-scheduler.js";
import type { Unit } from "./unit.js";
import type { Status } from "./status.js";

export type SkillCaster = (unit: Unit, ctx: SkillContext) => Routine;
export type SkillParams = Record<string, unknown>;

export type SkillDefinition = {
  name: string;
  caster: SkillCaster;
};

export type SkillContext = {
  skill: string;
  caster: SkillCaster;
  battleContext: BattleContext;
  params: SkillParams;
  status: Status.Status;
  rawStatus: Status.RawStatus;
};

export function cast(unit: Unit, ctx: SkillContext): void {
  ctx.battleContext.taskScheduler.start(() => ctx.caster(unit, ctx));
}
