import type { PlayerState } from "./state.js";
import { Item } from "./item/item.js";
import type { TabletSpec } from "./tablet/spec.js";

export type ValidateError = {
  kind: string;
  message: string;
};

namespace validator {
  function deepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (
      a === null ||
      b === null ||
      typeof a !== "object" ||
      typeof b !== "object"
    ) {
      return false;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((value, index) => deepEqual(value, b[index]))
      );
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]),
      )
    );
  }

  export function inventory(
    src: PlayerState,
    dst: PlayerState,
  ): string | undefined {
    for (const item of dst.inventory) {
      if (item !== null && !Item.Kinds.includes(item.kind)) {
        return "Inventory item kind error.";
      }
    }
    return undefined;
  }

  export function tablet(
    src: PlayerState,
    dst: PlayerState,
  ): string | undefined {
    const srcTablets = new Map<string, TabletSpec.Tablet>();
    const dstTablets = new Map<string, TabletSpec.Tablet>();
    for (const state of [src, dst]) {
      for (const item of state.inventory) {
        if (item?.kind === "tablet" && item.uuid !== item.tablet.uuid) {
          return "Inventory item UUID must match its tablet UUID.";
        }
      }
    }
    for (const [state, tablets] of [
      [src, srcTablets],
      [dst, dstTablets],
    ] as const) {
      const slots = [
        ...state.tablets,
        ...state.inventory.flatMap((item) =>
          item?.kind === "tablet" ? [item.tablet] : [],
        ),
      ];
      for (const tablet of slots) {
        if (tablet === null) continue;
        if (![0, 90, 180, 270].includes(tablet.rotate)) {
          return `Invalid tablet rotation: ${tablet.uuid}.`;
        }
        if (tablets.has(tablet.uuid)) {
          return `Duplicate tablet UUID: ${tablet.uuid}.`;
        }
        tablets.set(tablet.uuid, tablet);
      }
    }
    if (srcTablets.size !== dstTablets.size) {
      return "Tablet count must not change.";
    }
    for (const [uuid, tablet] of srcTablets) {
      const next = dstTablets.get(uuid);
      if (!next) {
        return `Tablet UUID missing from destination: ${uuid}.`;
      }
      const { rotate: _a, ...left } = tablet;
      const { rotate: _b, ...right } = next;
      if (!deepEqual(left, right)) {
        return `Tablet data must not change: ${uuid}.`;
      }
    }
    return undefined;
  }
  export function pendingLoot(
    src: PlayerState,
    dst: PlayerState,
  ): string | undefined {
    if (!deepEqual(src.pendingLoot, dst.pendingLoot)) {
      return "Pending loot must not change.";
    }
    return undefined;
  }
  export const validators = { inventory, tablet, pendingLoot };
}

export function stateValidate(
  src: PlayerState,
  dst: PlayerState,
): ValidateError | null {
  for (const [kind, validate] of Object.entries(validator.validators)) {
    const message = validate(src, dst);
    if (message !== undefined) {
      return { kind, message };
    }
  }
  return null;
}
