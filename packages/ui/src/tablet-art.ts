import { Container, Sprite } from "pixi.js";
import { TabletMap, TabletSpec, type GameData } from "@infinite-build/core";
import {
  resolveSupportTabletIcon,
  supportTabletScale,
} from "@infinite-build/renderer";
import type { TabletArt } from "@infinite-build/assets";
export { loadTabletArt } from "@infinite-build/assets";
export type { TabletArt } from "@infinite-build/assets";

/** Pixel stone arrows share the original support tablet style and rarity colors. */
export function createSupportTabletArt(
  kind: "tablet-support-skill" | "tablet-support-passive",
  rarity: TabletSpec.Tablet["rarity"],
  icons: TabletArt["icons"],
  size: number,
  rotation: TabletMap.Rotate = 0,
  targets?: readonly (readonly [number, number])[],
): Container {
  const art = new Container();
  const appearance = resolveSupportTabletIcon(targets, kind, rarity);
  const stone = new Sprite(icons[appearance.icon]);
  stone.anchor.set(0.5);
  const [dx, dy] = TabletMap.rotateVec(...appearance.offset, rotation);
  stone.position.set(size * (0.5 + dx), size * (0.5 + dy));
  const scale = supportTabletScale(
    stone.texture.frame,
    icons["support-skill"]!.frame,
    appearance.icon.startsWith("support-diagonal-"),
  );
  stone.width = size * scale.x;
  stone.height = size * scale.y;
  stone.angle = rotation + appearance.angle;
  art.addChild(stone);
  return art;
}

/** Same composition as mockapp: four rotated quarters underneath a 70% center. */
export function createTabletArt(
  tablet: TabletSpec.Tablet,
  assets: TabletArt,
  size: number,
  gameData: GameData,
): Container {
  const art = new Container();
  art.eventMode = "none";
  art.pivot.set(size / 2);
  const half = size / 2;
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const affix = tablet.affixes[quadrant];
    const quarter = new Container();
    quarter.position.set(
      quadrant === 1 || quadrant === 2 ? half : 0,
      quadrant >= 2 ? half : 0,
    );
    const sprite = new Sprite(assets.affixIcon(affix?.id));
    sprite.anchor.set(0.5);
    sprite.position.set(half / 2);
    sprite.width = sprite.height = half;
    sprite.angle = quadrant * 90;
    quarter.addChild(sprite);
    art.addChild(quarter);
  }
  if (
    tablet.kind === "tablet-support-skill" ||
    tablet.kind === "tablet-support-passive"
  ) {
    const center = createSupportTabletArt(
      tablet.kind,
      tablet.rarity,
      assets.icons,
      size * 0.7,
      tablet.rotate,
      TabletSpec.getSupportDelta(gameData, tablet),
    );
    center.position.set(size * 0.15);
    art.addChild(center);
    return art;
  }
  const center = new Sprite(
    tablet.kind === "tablet-skill"
      ? assets.skillIcon(tablet.skill, tablet.rarity)
      : assets.icons[
          tablet.rarity === "rare" ? "passive-rare" : "passive-magic"
        ],
  );
  center.anchor.set(0.5);
  center.position.set(size / 2);
  center.width = center.height = size * 0.7;
  art.addChild(center);
  return art;
}
