import { Attribute } from "./attribute.js";
import { Trigger } from "./trigger.js";

export type Status = {
  attributes: Status.Attributes;
  triggers: Trigger;
};

export namespace Status {
  export type Modifier = {
    attributes?: Attribute.Dict;
    triggers?: Trigger;
  };
  export type Attributes = Attribute.Dict;
  export type RawStatus = {
    attributes: Record<string, number>;
    triggers: Trigger;
  };
  export type StatusConfig = {
    attributes?: Record<string, number>;
    triggers?: Trigger;
  };

  export function createByConfig(config: StatusConfig): Status {
    return {
      attributes: Attribute.createDictByRaw(config.attributes),
      triggers: Trigger.merge(config.triggers ?? {}),
    };
  }

  export function apply(status: Status, modifiers: Modifier[]): Status {
    return {
      attributes: Attribute.mergeDict(
        status.attributes,
        ...modifiers.map((modifier) => modifier.attributes),
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
      triggers: Trigger.merge(status.triggers),
    };
  }
}
