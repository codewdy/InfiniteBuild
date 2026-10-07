import { Assets, Rectangle, Texture } from "pixi.js";

export type CharacterTextures = { idle: Texture; action: Texture };
export type BattlefieldAssets = {
  background: Texture;
  characters: Record<string, CharacterTextures>;
  fireball: Texture[];
  nova: Texture[];
};
type AtlasManifest = {
  background: string;
  image: string;
  frames: Record<string, {
    image?: string;
    frame: [number, number, number, number];
    size: [number, number];
    alignment: "feet" | "center";
  }>;
  characters: Record<string, { idle: string; action: string }>;
  effects: { fireball: string[]; nova: string[] };
};

let loading: Promise<BattlefieldAssets> | undefined;

/** Shared atlas textures survive scene resets; sprites own only their display state. */
export function loadBattlefieldAssets(): Promise<BattlefieldAssets> {
  loading ??= loadAtlas().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

async function loadAtlas(): Promise<BattlefieldAssets> {
  const base = new URL("../assets/pixel-battle/", import.meta.url);
  const response = await fetch(new URL("atlas.json", base));
  if (!response.ok) throw new Error(`Failed to load battle atlas: ${response.status}`);
  const manifest = await response.json() as AtlasManifest;
  const [atlas, background] = await Promise.all([
    Assets.load<Texture>(new URL(manifest.image, base).href),
    Assets.load<Texture>(new URL(manifest.background, base).href),
  ]);
  background.source.scaleMode = "nearest";
  atlas.source.scaleMode = "nearest";
  const images = new Map<string, Texture>([[manifest.image, atlas]]);
  const textures: Record<string, Texture> = {};
  for (const [name, entry] of Object.entries(manifest.frames)) {
    const image = entry.image ?? manifest.image;
    let source = images.get(image);
    if (!source) {
      source = await Assets.load<Texture>(new URL(image, base).href);
      source.source.scaleMode = "nearest";
      images.set(image, source);
    }
    const [x, y, width, height] = entry.frame;
    const [canvasWidth, canvasHeight] = entry.size;
    textures[name] = new Texture({
      source: source.source,
      frame: new Rectangle(x, y, width, height),
      orig: new Rectangle(0, 0, canvasWidth, canvasHeight),
      trim: new Rectangle(
        (canvasWidth - width) / 2,
        entry.alignment === "feet" ? canvasHeight - height : (canvasHeight - height) / 2,
        width,
        height,
      ),
    });
  }
  const texture = (name: string): Texture => {
    const result = textures[name];
    if (!result) throw new Error(`Missing battle texture: ${name}`);
    return result;
  };
  return {
    background,
    characters: Object.fromEntries(Object.entries(manifest.characters).map(([kind, poses]) => [
      kind, { idle: texture(poses.idle), action: texture(poses.action) },
    ])),
    fireball: manifest.effects.fireball.map(texture),
    nova: manifest.effects.nova.map(texture),
  };
}
