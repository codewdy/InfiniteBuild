import type { Affix } from "../affix.js";
import type { TabletSpec } from "../tablet/spec.js";

export namespace Item {
  export type Rarity = "normal" | "magic" | "rare";
  export type ItemBase = {
    uuid: string;
    rarity: Rarity;
    affixes: Affix.Spec[];
  };
  export const Kinds = [
    "tablet-skill",
    "tablet-support-skill",
    "tablet-support-passive",
    "tablet-passive",
  ];
}

export type Item = TabletSpec.Tablet;
