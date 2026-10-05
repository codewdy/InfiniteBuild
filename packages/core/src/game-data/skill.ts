import type { z } from "zod";
import type {
  SkillCaster,
  SkillContext,
  SkillDefinition,
} from "../battle/combat/skill.js";
import type { UnitSkill } from "../battle/combat/skill-trigger.js";

type TypedSkillCaster<Schema extends z.ZodObject> = (
  ctx: Parameters<SkillCaster>[0],
  unit: Parameters<SkillCaster>[1],
  skill: Omit<SkillContext, "params"> & { params: z.output<Schema> },
) => ReturnType<SkillCaster>;

type TypedSkillDefinition<Schema extends z.ZodObject> = Omit<
  SkillDefinition,
  "caster"
> & {
  id: string;
  params: Schema;
  caster: TypedSkillCaster<NoInfer<Schema>>;
};
type TypedUnitSkill<Schema extends z.ZodObject> = Omit<
  UnitSkill,
  "params" | "skill"
> & {
  params: z.input<Schema>;
};

type ResolvedSkillDefinition<Schema extends z.ZodObject> = {
  id: string;
  definition: SkillDefinition;
  skill: (definition: TypedUnitSkill<Schema>) => UnitSkill;
};

export function defineSkill<Schema extends z.ZodObject>(
  definition: TypedSkillDefinition<Schema>,
): ResolvedSkillDefinition<Schema> {
  const { id, params, caster, ...fields } = definition;
  return {
    id,
    definition: {
      ...fields,
      caster(ctx, unit, skill) {
        return caster(ctx, unit, {
          ...skill,
          params: params.parse(skill.params),
        });
      },
    },
    skill(unitSkill) {
      return {
        ...unitSkill,
        skill: id,
        params: structuredClone(unitSkill.params),
      };
    },
  };
}

export function skills(
  lst: { id: string; definition: SkillDefinition }[],
): Record<string, SkillDefinition> {
  return Object.fromEntries(lst.map(({ id, definition }) => [id, definition]));
}
