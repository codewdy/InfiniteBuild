import { Assets } from "pixi.js";
import type { Texture } from "pixi.js";

export type DrawerAssets = { board: Texture; inventory: Texture };

export async function loadDrawerAssets(): Promise<DrawerAssets> {
  const [board, inventory] = await Promise.all([
    Assets.load<Texture>(new URL("../assets/tablet-board-background.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/inventory-background.png", import.meta.url).href),
  ]);
  board.source.scaleMode = inventory.source.scaleMode = "nearest";
  return { board, inventory };
}
