import type { Item } from "./item.js";

export namespace Inventory {
  export type Slot = Item | null;
}

export type Inventory = Inventory.Slot[];
