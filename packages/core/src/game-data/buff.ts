import type { z } from "zod";
import type { BuffDefinition } from "../battle/combat/buff.js";

type TypedBuffModifier<Schema extends z.ZodObject> = (
  level: Parameters<BuffDefinition["modifier"]>[0],
  params: z.output<Schema>,
  totalDuration: Parameters<BuffDefinition["modifier"]>[2],
  current: Parameters<BuffDefinition["modifier"]>[3],
) => ReturnType<BuffDefinition["modifier"]>;

type TypedBuffDefinition<Schema extends z.ZodObject> = Omit<
  BuffDefinition,
  "modifier"
> & {
  id: string;
  params: Schema;
  modifier: TypedBuffModifier<NoInfer<Schema>>;
};

type ResolvedBuffDefinition<Schema extends z.ZodObject> = {
  id: string;
  definition: BuffDefinition;
  params: (params: z.input<Schema>) => z.input<Schema>;
};

export function defineBuff<Schema extends z.ZodObject>(
  definition: TypedBuffDefinition<Schema>,
): ResolvedBuffDefinition<Schema> {
  const { id, params: schema, modifier, ...fields } = definition;
  return {
    id,
    definition: {
      ...fields,
      modifier(level, params, totalDuration, current) {
        return modifier(level, schema.parse(params), totalDuration, current);
      },
    },
    params(params) {
      return structuredClone(params);
    },
  };
}

export function buffs(
  lst: { id: string; definition: BuffDefinition }[],
): Record<string, BuffDefinition> {
  return Object.fromEntries(lst.map(({ id, definition }) => [id, definition]));
}
