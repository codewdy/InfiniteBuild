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
  "caster" | "description"
> & {
  id: string;
  params: Schema;
  caster: TypedSkillCaster<NoInfer<Schema>>;
  description?: (params: z.output<NoInfer<Schema>>) => string;
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
  const { id, params, caster, description, ...fields } = definition;
  return {
    id,
    definition: {
      ...fields,
      caster: caster as SkillCaster,
      ...(description ? {
        description: (values) => description(params.parse(values)),
      } : {}),
    },
    skill(unitSkill) {
      return {
        ...unitSkill,
        skill: id,
        params: params.parse(unitSkill.params),
      };
    },
  };
}

export function skills(
  lst: { id: string; definition: SkillDefinition }[],
): Record<string, SkillDefinition> {
  return Object.fromEntries(lst.map(({ id, definition }) => [id, definition]));
}
