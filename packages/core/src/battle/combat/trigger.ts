import type { Unit } from "./unit.js";
import type { BattleContext } from "../battle.js";

export type Trigger = {
  [K in keyof Trigger.Callbacks]?: Trigger.Callbacks[K][];
};

export namespace Trigger {
  export const Name = [
    "onUpdate",
    "onDeath",
    "onHitDealt",
    "onHitReceived",
    "onDamageDealt",
    "onDamageReceived",
    "onHeal",
    "onKill",
  ] as const;
  export type Callbacks = {
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
  export function merge(...sources: Trigger[]): Trigger {
    return Object.fromEntries(
      Name.flatMap((name) => {
        const callbacks = sources.flatMap((source) => source[name] ?? []);
        return callbacks.length > 0 ? [[name, callbacks]] : [];
      }),
    ) as Trigger;
  }
}
