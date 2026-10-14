import type { Texture } from "pixi.js";
import { loadGroup, squareTexture } from "./loader.js";
import type { IconName } from "./types.js";

export type TabletArt = {
  icons: Record<IconName, Texture>;
  affixes: Record<string, Texture>;
};

export async function loadTabletArt(): Promise<TabletArt> {
  const { manifest, textures } = await loadGroup("tablets");
  const map = (entries: Record<string, string>): Record<string, Texture> =>
    Object.fromEntries(
      Object.entries(entries).map(([name, id]) => [
        name,
        squareTexture(manifest.frames[id]!, textures[id]!),
      ]),
    );
  return {
    icons: map(manifest.icons!) as Record<IconName, Texture>,
    affixes: map(manifest.affixIcons!),
  };
}
