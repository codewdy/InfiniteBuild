import type { BattleContext } from "../battle.js";
import type { Routine } from "../task-scheduler.js";
import type { Unit } from "./unit.js";
import type { Status } from "./status.js";

export type SkillCaster = (
  ctx: BattleContext,
  unit: Unit,
  skill: SkillContext,
) => Routine;
export type SkillParams = Record<string, unknown>;

export type SkillDefinition = {
  name: string;
  description: (params: SkillParams) => string;
  caster: SkillCaster;
};

export type SkillContext = {
  uuid: string;
  skill: string;
  caster: SkillCaster;
  castRate?: number;
  battleContext: BattleContext;
  params: SkillParams;
  status: Status;
  rawStatus: Status.RawStatus;
};

export function cast(
  ctx: BattleContext,
  unit: Unit,
  skill: SkillContext,
): void {
  ctx.taskScheduler.start(() => skill.caster(ctx, unit, skill));
}
