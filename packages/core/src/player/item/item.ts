import type { TabletSpec } from "../tablet/spec.js";

export namespace Item {
  export const Kinds = ["tablet"];
  export type Tablet = {
    kind: "tablet";
    uuid: string;
    tablet: TabletSpec.Tablet;
  };
}

export type Item = Item.Tablet;
