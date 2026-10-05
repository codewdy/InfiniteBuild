import { Attribute } from "./attribute.js";
import { Trigger } from "./trigger.js";

export namespace Status {
  export const FieldName = ["maxHp", "attack", "defense"] as const;
  export type Field = (typeof FieldName)[number];

  export function mergeTags(
    ...sources: (ReadonlySet<string> | readonly string[] | undefined)[]
  ): Set<string> {
    const tags = new Set<string>();
    for (const source of sources) {
      for (const tag of source ?? []) {
        tags.add(tag);
      }
    }
    return tags;
  }

  export type Modifier = {
    attributes?: Attribute.DictModifier<Field>;
    tags?: Set<string> | string[];
    triggers?: Trigger;
  };
  export type Attributes = Attribute.Dict<Field>;
  export type Status = {
    attributes: Attributes;
    tags: Set<string>;
    triggers: Trigger;
  };
  export type RawStatus = {
    attributes: Record<Field, number>;
    tags: Set<string>;
    triggers: Trigger;
  };
  export type StatusConfig = {
    attributes?: Partial<Record<Field, number>>;
    tags?: string[];
    triggers?: Trigger;
  };

  export function createByConfig(config: StatusConfig): Status {
    return {
      attributes: Object.fromEntries(
        FieldName.map((field) => [
          field,
          { base: config.attributes?.[field] ?? 0, inc: 0, more: 0 },
        ]),
      ) as Attributes,
      tags: new Set(config.tags),
      triggers: Trigger.merge(config.triggers ?? {}),
    };
  }

  export function apply(status: Status, modifiers: Modifier[]): Status {
    return {
      attributes: Attribute.mergeDict(
        status.attributes,
        ...modifiers.map((modifier) => modifier.attributes),
      ),
      tags: mergeTags(
        status.tags,
        ...modifiers.map((modifier) => modifier.tags),
      ),
      triggers: Trigger.merge(
        status.triggers,
        ...modifiers.map((modifier) => modifier.triggers ?? {}),
      ),
    };
  }

  export function resolve(status: Status): RawStatus {
    return {
      attributes: Attribute.resolveDict(status.attributes),
      tags: mergeTags(status.tags),
      triggers: Trigger.merge(status.triggers),
    };
  }
}
