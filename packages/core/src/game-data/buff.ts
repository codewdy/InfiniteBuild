import type { BuffDefinition } from "../battle/combat/buff.js";
import type { Status } from "../battle/combat/status.js";
import { Trigger } from "../battle/combat/trigger.js";

type ResolvedBuffDefinition = {
  id: string;
  definition: BuffDefinition;
};

type SimpleBuffDefinition = {
  id: string;
  attributes?: (level: number) => Status.Attributes;
} & Omit<BuffDefinition, "modifier"> &
  Partial<Trigger.Callbacks>;

export function defineBuff(
  definition: SimpleBuffDefinition,
): ResolvedBuffDefinition {
  const { id, attributes, stack, threshold } = definition;
  const triggers: Trigger = Object.fromEntries(
    Trigger.Name.flatMap((name) => {
      const callback = definition[name];
      return callback ? [[name, [callback]]] : [];
    }),
  );
  return {
    id,
    definition: {
      stack,
      threshold,
      modifier(level) {
        return { attributes: attributes?.(level), triggers };
      },
    },
  };
}

export function buffs(
  lst: ResolvedBuffDefinition[],
): Record<string, BuffDefinition> {
  return Object.fromEntries(lst.map(({ id, definition }) => [id, definition]));
}
