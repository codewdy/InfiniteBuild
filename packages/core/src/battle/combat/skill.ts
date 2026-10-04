import type { BattleContext } from "../battle.js";
import type { Routine } from "../task-scheduler.js";
import type { Unit } from "./unit.js";

export type SkillParams = Record<string, unknown>;

export type SkillDefinition = {
  name: string;
  caster: (unit: Unit, ctx: BattleContext, params: SkillParams) => Routine;
};

export function cast(
  ctx: BattleContext,
  unit: Unit,
  skill: string,
  params: SkillParams,
): void {
  const definition = ctx.gameData.skillDefinitions[skill];
  if (!definition) throw new Error(`Unknown skill: ${skill}`);
  const castParams = structuredClone(params);
  ctx.taskScheduler.start(() => definition.caster(unit, ctx, castParams));
}
