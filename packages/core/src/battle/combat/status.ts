import type { Unit } from "./unit.js";
import type { BattleContext } from "../battle.js";

export namespace Status {
  export const FieldName = ["maxHp", "attack", "defense"] as const;
  export type Field = (typeof FieldName)[number];

  export type FieldStatus = {
    base: number;
    inc: number;
    more: number;
  };

  export const TriggerName = [
    "onUpdate",
    "onDeath",
    "onHitDealt",
    "onHitReceived",
    "onDamageDealt",
    "onDamageReceived",
    "onHeal",
    "onKill",
  ] as const;
  export type TriggerCallbacks = {
    onUpdate: (self: Unit, ctx: BattleContext) => void;
    onDeath: (self: Unit, ctx: BattleContext) => void;
    onHitDealt: (
      self: Unit,
      ctx: BattleContext,
      dst: Unit,
      amount: number,
    ) => void;
    onHitReceived: (
      self: Unit,
      ctx: BattleContext,
      src: Unit,
      amount: number,
    ) => void;
    onDamageDealt: (
      self: Unit,
      ctx: BattleContext,
      dst: Unit,
      amount: number,
    ) => void;
    onDamageReceived: (
      self: Unit,
      ctx: BattleContext,
      src: Unit | null,
      amount: number,
    ) => void;
    onHeal: (
      self: Unit,
      ctx: BattleContext,
      src: Unit | null,
      amount: number,
    ) => void;
    onKill: (self: Unit, ctx: BattleContext, dst: Unit) => void;
  };
  export type Triggers = {
    [K in keyof TriggerCallbacks]?: TriggerCallbacks[K][];
  };

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

  export function mergeTriggers(...sources: Triggers[]): Triggers {
    return Object.fromEntries(
      TriggerName.flatMap((name) => {
        const callbacks = sources.flatMap((source) => source[name] ?? []);
        return callbacks.length > 0 ? [[name, callbacks]] : [];
      }),
    ) as Triggers;
  }

  export type FieldModifier = Partial<FieldStatus>;
  export type Modifier = {
    attributes?: Partial<Record<Field, FieldModifier>>;
    tags?: Set<string> | string[];
    triggers?: Triggers;
  };
  export type Attributes = Record<Field, FieldModifier>;
  export type Status = {
    attributes: Attributes;
    tags: Set<string>;
    triggers: Triggers;
  };
  export type RawStatus = {
    attributes: Record<Field, number>;
    tags: Set<string>;
    triggers: Triggers;
  };
  export type StatusConfig = {
    attributes?: Partial<Record<Field, number>>;
    tags?: string[];
    triggers?: Triggers;
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
      triggers: mergeTriggers(config.triggers ?? {}),
    };
  }

  export function mergeField(
    ...sources: (FieldModifier | undefined)[]
  ): FieldStatus {
    let base = 0;
    let inc = 0;
    let multiplier = 1;
    for (const value of sources) {
      if (!value) continue;
      base += value.base ?? 0;
      inc += value.inc ?? 0;
      multiplier *= 1 + (value.more ?? 0);
    }
    return { base, inc, more: multiplier - 1 };
  }

  export function apply(status: Status, modifiers: Modifier[]): Status {
    return {
      attributes: Object.fromEntries(
        FieldName.map((field) => [
          field,
          mergeField(
            status.attributes[field],
            ...modifiers.map((modifier) => modifier.attributes?.[field]),
          ),
        ]),
      ) as Attributes,
      tags: mergeTags(
        status.tags,
        ...modifiers.map((modifier) => modifier.tags),
      ),
      triggers: mergeTriggers(
        status.triggers,
        ...modifiers.map((modifier) => modifier.triggers ?? {}),
      ),
    };
  }

  export function resolveField(value: FieldModifier): number {
    return (value.base ?? 0) * (1 + (value.inc ?? 0)) * (1 + (value.more ?? 0));
  }

  export function resolve(status: Status): RawStatus {
    return {
      attributes: Object.fromEntries(
        FieldName.map((field) => [
          field,
          resolveField(status.attributes[field]),
        ]),
      ) as RawStatus["attributes"],
      tags: mergeTags(status.tags),
      triggers: mergeTriggers(status.triggers),
    };
  }
}
