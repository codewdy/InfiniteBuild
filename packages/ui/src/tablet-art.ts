import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { TabletSpec } from "@infinite-build/core";
import { loadBattlefieldIcons, loadPassiveAffixIcons } from "@infinite-build/renderer";
import type { IconAsset, IconName } from "@infinite-build/renderer";

export type TabletArt = {
  icons: Record<IconName, Texture>;
  affixes: Record<string, Texture>;
  destroy(): void;
};

/** Match the square SVG crops used by mockapp, sharing the atlas image sources. */
export async function loadTabletArt(): Promise<TabletArt> {
  const [icons, affixes] = await Promise.all([loadBattlefieldIcons(), loadPassiveAffixIcons()]);
  const sources = new Map(await Promise.all(
    [...new Set([...Object.values(icons), ...Object.values(affixes)].map(asset => asset.image))]
      .map(async image => [image, await Assets.load<Texture>(image)] as const),
  ));
  const textures = new Map<string, Texture>();
  const crop = (asset: IconAsset): Texture => {
    const key = JSON.stringify([asset.image, asset.frame]);
    let texture = textures.get(key);
    if (!texture) {
      const [x, y, width, height] = asset.frame;
      const size = Math.max(width, height);
      texture = new Texture({
        source: sources.get(asset.image)!.source,
        frame: new Rectangle(x, y, width, height),
        orig: new Rectangle(0, 0, size, size),
        trim: new Rectangle((size - width) / 2, (size - height) / 2, width, height),
      });
      textures.set(key, texture);
    }
    return texture;
  };
  return {
    icons: Object.fromEntries(Object.entries(icons).map(([name, asset]) => [name, crop(asset)])) as Record<IconName, Texture>,
    affixes: Object.fromEntries(Object.entries(affixes).map(([name, asset]) => [name, crop(asset)])),
    destroy() {
      for (const texture of textures.values()) texture.destroy(false);
      textures.clear();
    },
  };
}

/** Same composition as mockapp: four rotated quarters underneath a 70% center. */
export function createTabletArt(tablet: TabletSpec.Tablet, assets: TabletArt, size: number): Container {
  const art = new Container();
  art.eventMode = "none";
  art.pivot.set(size / 2);
  const half = size / 2;
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const affix = tablet.affixes[quadrant];
    const quarter = new Container();
    quarter.position.set(quadrant === 1 || quadrant === 2 ? half : 0, quadrant >= 2 ? half : 0);
    const sprite = new Sprite(affix ? assets.affixes[affix.id] ?? assets.icons["passive-quarter-empty"] : assets.icons["passive-quarter-empty"]);
    sprite.anchor.set(0.5);
    sprite.position.set(half / 2);
    sprite.width = sprite.height = half;
    sprite.angle = quadrant * 90;
    quarter.addChild(sprite);
    art.addChild(quarter);
  }
  const icon: IconName = tablet.kind === "tablet-skill"
    ? tablet.skill === "nova" ? "nova" : "fireball"
    : tablet.kind === "tablet-passive" ? tablet.rarity === "rare" ? "passive-rare" : "passive-magic"
    : tablet.kind === "tablet-support-skill" ? "support-skill" : "support-passive";
  const center = new Sprite(assets.icons[icon]);
  center.anchor.set(0.5);
  center.angle = "rotate" in tablet ? tablet.rotate : 0;
  center.position.set(size / 2);
  center.width = center.height = size * 0.7;
  art.addChild(center);
  return art;
}
