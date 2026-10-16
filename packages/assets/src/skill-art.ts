import {
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Rectangle,
  Sprite,
  type Texture,
} from "pixi.js";

/** Centered, 100-unit artwork. Only the emblem gets rarity shaders. */
export function createSkillArt(
  icon: Texture,
  background?: Texture,
  rarity = "normal",
): Container {
  const art = new Container();
  art.eventMode = "none";
  art.boundsArea = new Rectangle(-50, -50, 100, 100);
  const layer = (texture: Texture, size: number) => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = size;
    art.addChild(sprite);
    return sprite;
  };
  if (!background) {
    layer(icon, 100);
    return art;
  }
  layer(background, 115);
  if (rarity === "magic" || rarity === "rare") {
    const halo = layer(icon, rarity === "rare" ? 82 : 78);
    halo.blendMode = "add";
    const color = rarity === "rare" ? [1, 0.75, 0.12] : [0.18, 0.65, 1];
    const tint = new ColorMatrixFilter();
    tint.matrix = [
      0,
      0,
      0,
      0,
      color[0]!,
      0,
      0,
      0,
      0,
      color[1]!,
      0,
      0,
      0,
      0,
      color[2]!,
      0,
      0,
      0,
      1,
      0,
    ];
    const blur = new BlurFilter({
      strength: rarity === "rare" ? 6 : 5,
      quality: 3,
    });
    halo.filters = [tint, blur];
    halo.on("destroyed", () => {
      tint.destroy();
      blur.destroy();
    });
  }
  layer(icon, 64);
  return art;
}
