import { Assets } from "pixi.js";
import type { Texture } from "pixi.js";

export type DrawerAssets = { board: Texture; inventory: Texture; inventoryWide: Texture; background: Texture; randomSkill: { magic: Texture; rare: Texture }; tabs: { tablets: Texture; loot: Texture } };

export async function loadDrawerAssets(): Promise<DrawerAssets> {
  const [board, inventory, inventoryWide, background, tabletsTab, lootTab, randomSkillRare, randomSkillMagic] = await Promise.all([
    Assets.load<Texture>(new URL("../assets/tablet-board-background.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/inventory-background.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/inventory-background-wide.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/loadout-background.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/tab-tablets.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/tab-loot.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/random-skill-tablet.png", import.meta.url).href),
    Assets.load<Texture>(new URL("../assets/random-skill-tablet-magic.png", import.meta.url).href),
  ]);
  board.source.scaleMode = inventory.source.scaleMode = inventoryWide.source.scaleMode = background.source.scaleMode = "nearest";
  tabletsTab.source.scaleMode = lootTab.source.scaleMode = randomSkillRare.source.scaleMode = randomSkillMagic.source.scaleMode = "nearest";
  return { board, inventory, inventoryWide, background, randomSkill: { magic: randomSkillMagic, rare: randomSkillRare }, tabs: { tablets: tabletsTab, loot: lootTab } };
}
