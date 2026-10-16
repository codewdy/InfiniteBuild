import { resolveAffixFrame, resolveSkillIcon } from "./visuals.js";
import type { BattleManifest } from "./manifest.js";
import { createSkillArt } from "./skill-art.js";
import type { Container, Texture } from "pixi.js";
import { loadGroup, squareTexture } from "./loader.js";
import type { IconName } from "./types.js";

export type TabletArt = {
  icons: Record<IconName, Texture>;
  affixes: Record<string, Texture>;
  createSkillIcon: (skill: string, rarity?: string) => Container;
  skillIcon: (skill: string, rarity?: string) => Texture;
  affixIcon: (affix?: string) => Texture;
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
  const visuals = manifest as BattleManifest;
  const icons = map(manifest.icons!);
  const affixIcon = (id?: string): Texture => {
    const frame = resolveAffixFrame(visuals, id);
    return squareTexture(manifest.frames[frame]!, textures[frame]!);
  };
  return {
    icons,
    affixes: Object.fromEntries(
      Object.keys(visuals.affixVisuals).map((id) => [id, affixIcon(id)]),
    ),
    skillIcon: (id, rarity) => icons[resolveSkillIcon(visuals, id, rarity)]!,
    createSkillIcon: (id, rarity) => {
      const background = visuals.skillIcons[id]?.background;
      return createSkillArt(
        icons[resolveSkillIcon(visuals, id, rarity)]!,
        background ? icons[background] : undefined,
        rarity,
      );
    },
    affixIcon,
  };
}
