import { Assets, Rectangle, Texture } from "pixi.js";

export type CharacterAnimation = "idle" | "walk" | "cast" | "attack" | "hit" | "death";
export type CharacterClip = { frames: Texture[]; durationMs: number; loop: boolean };
export type CharacterTextures = {
  scale: number;
  animations: Record<CharacterAnimation, CharacterClip>;
};
export type IconName = "fireball" | "nova" | "fireball-magic" | "fireball-rare" | "nova-magic" | "nova-rare" | "passive" | "passive-magic" | "passive-rare" | "passive-quarter-empty" | "support-skill" | "support-passive" | "support-rare" | "pending" | "xp";
export type IconAsset = {
  image: string;
  frame: [number, number, number, number];
  imageWidth: number;
  imageHeight: number;
};
export type SettlementAssets = {
  emblems: Record<"Victory" | "Defeat", Texture>;
  rewards: Record<"skill" | "passive" | "support-skill" | "support-passive" | "pending" | "xp", Texture>;
};
export type BattlefieldAssets = {
  background: Texture;
  characters: Record<string, CharacterTextures>;
  fireball: Texture[];
  nova: Texture[];
  attack: Texture[];
  icons: Record<IconName, IconAsset>;
  affixIcons: Record<string, IconAsset>;
  skillTablets: Record<string, Texture>;
  settlement: SettlementAssets;
};
type AtlasManifest = {
  background: string;
  image: string;
  frames: Record<string, {
    image?: string;
    frame: [number, number, number, number];
    size: [number, number];
    alignment: "feet" | "center";
    offset?: [number, number];
  }>;
  characters: Record<string, {
    scale: number;
    animations: Record<CharacterAnimation, { frames: string[]; durationMs: number; loop: boolean }>;
  }>;
  effects: { fireball: string[]; nova: string[]; attack: string[] };
  icons: Record<IconName, string>;
  affixIcons: Record<string, string>;
  skillTablets: Record<string, string>;
  settlement: {
    [K in keyof SettlementAssets]: Record<keyof SettlementAssets[K], string>;
  };
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

/** HTML UI and Pixi settlements share the same icon regions and source images. */
export async function loadBattlefieldIcons(): Promise<Record<IconName, IconAsset>> {
  return (await loadBattlefieldAssets()).icons;
}

export async function loadPassiveAffixIcons(): Promise<Record<string, IconAsset>> {
  return (await loadBattlefieldAssets()).affixIcons;
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
        entry.offset?.[0] ?? (canvasWidth - width) / 2,
        entry.offset?.[1] ?? (entry.alignment === "feet" ? canvasHeight - height : (canvasHeight - height) / 2),
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
  const iconAsset = (key: string): IconAsset => {
    const entry = manifest.frames[key]!;
    const source = texture(key).source;
    return {
      image: new URL(entry.image ?? manifest.image, base).href,
      frame: entry.frame,
      imageWidth: source.width,
      imageHeight: source.height,
    };
  };
  return {
    background,
    characters: Object.fromEntries(Object.entries(manifest.characters).map(([kind, poses]) => [
      kind, {
        scale: poses.scale,
        animations: Object.fromEntries(Object.entries(poses.animations).map(([name, clip]) => {
          if (!clip.frames.length || !Number.isFinite(clip.durationMs) || clip.durationMs <= 0) {
            throw new Error(`Invalid character animation: ${kind}.${name}`);
          }
          return [name, { ...clip, frames: clip.frames.map(texture) }];
        })) as CharacterTextures["animations"],
      },
    ])),
    fireball: manifest.effects.fireball.map(texture),
    nova: manifest.effects.nova.map(texture),
    attack: manifest.effects.attack.map(texture),
    skillTablets: Object.fromEntries(Object.entries(manifest.skillTablets).map(([skill, name]) => [skill, texture(name)])),
    icons: Object.fromEntries(Object.entries(manifest.icons).map(([name, key]) => [name, iconAsset(key)])) as Record<IconName, IconAsset>,
    affixIcons: Object.fromEntries(Object.entries(manifest.affixIcons).map(([name, key]) => [name, iconAsset(key)])),
    settlement: {
      emblems: Object.fromEntries(Object.entries(manifest.settlement.emblems).map(([kind, name]) => [kind, texture(name)])) as SettlementAssets["emblems"],
      rewards: Object.fromEntries(Object.entries(manifest.settlement.rewards).map(([kind, name]) => [kind, texture(name)])) as SettlementAssets["rewards"],
    },
  };
}
