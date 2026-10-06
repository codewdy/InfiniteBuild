import type { PlayerState } from "./state.js";
import { Item } from "./item/item.js";
import type { TabletSpec } from "./tablet/spec.js";

export type ValidateError = {
  kind: string;
  message: string;
};

namespace validator {
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
      if (tablet.kind !== next.kind || tablet.skill !== next.skill) {
        return `Tablet data must not change: ${uuid}.`;
      }
    }
    return undefined;
  }
  export const validators = { inventory, tablet };
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
