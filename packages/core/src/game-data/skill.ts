import type { z } from "zod";
import type { Skill } from "../battle/combat/skill.js";
import type { UnitSkill } from "../battle/combat/skill-trigger.js";

type TypedSkillCaster<Schema extends z.ZodObject> = (
  ctx: Parameters<Skill.Caster>[0],
  unit: Parameters<Skill.Caster>[1],
  skill: Omit<Skill.Context, "params"> & { params: z.output<Schema> },
) => ReturnType<Skill.Caster>;

type TypedSkillDefinition<Schema extends z.ZodObject> = Omit<
  Skill.Definition,
  "caster" | "description"
> & {
  id: string;
  params: Schema;
  caster: TypedSkillCaster<NoInfer<Schema>>;
  description: (params: z.output<NoInfer<Schema>>) => string;
};
type TypedUnitSkill<Schema extends z.ZodObject> = Omit<
  UnitSkill,
  "params" | "skill"
> & {
  params: z.input<Schema>;
};

type ResolvedSkillDefinition<Schema extends z.ZodObject> = {
  id: string;
  definition: Skill.Definition;
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
      caster: caster as Skill.Caster,
      description: (values) => description(params.parse(values)),
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
  lst: { id: string; definition: Skill.Definition }[],
): Record<string, Skill.Definition> {
  return Object.fromEntries(lst.map(({ id, definition }) => [id, definition]));
}
