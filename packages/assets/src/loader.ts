import { Assets, Rectangle, Texture } from "pixi.js";
import type { AssetGroup, AssetManifest, FrameDefinition } from "./manifest.js";

export type LoadedGroup = {
  manifest: AssetManifest;
  textures: Record<string, Texture>;
};
const runtime = new URL("../runtime/", import.meta.url);
export const assetURL = (path: string): string => new URL(path, runtime).href;
const loading = new Map<AssetGroup, Promise<LoadedGroup>>();
const images = new Map<string, Promise<Texture>>();
const ownedTextures = new Set<Texture>();
const squareTextures = new Map<string, Texture>();
let unloading: Promise<void> | undefined;

function loadImage(path: string): Promise<Texture> {
  let pending = images.get(path);
  if (!pending) {
    pending = Assets.load<Texture>(assetURL(path))
      .then((texture) => {
        texture.source.scaleMode = "nearest";
        return texture;
      })
      .catch((error: unknown) => {
        images.delete(path);
        throw error;
      });
    images.set(path, pending);
  }
  return pending;
}

function crop(
  source: Texture,
  entry: FrameDefinition,
  square = false,
): Texture {
  const [x, y, width, height] = entry.frame;
  const [canvasWidth, canvasHeight] = square
    ? [Math.max(width, height), Math.max(width, height)]
    : entry.size;
  const texture = new Texture({
    source: source.source,
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, canvasWidth, canvasHeight),
    trim: new Rectangle(
      square
        ? (canvasWidth - width) / 2
        : (entry.offset?.[0] ?? (canvasWidth - width) / 2),
      square
        ? (canvasHeight - height) / 2
        : (entry.offset?.[1] ??
            (entry.alignment === "feet"
              ? canvasHeight - height
              : (canvasHeight - height) / 2)),
      width,
      height,
    ),
  });
  ownedTextures.add(texture);
  return texture;
}

async function load(group: AssetGroup): Promise<LoadedGroup> {
  if (group === "battle") {
    const parts = await Promise.all(
      (
        [
          "characters",
          "backgrounds",
          "effects",
          "tablets",
          "battle-ui",
        ] as const
      ).map(loadGroup),
    );
    const manifest: AssetManifest = { frames: {} };
    const textures: Record<string, Texture> = {};
    for (const part of parts) {
      const frames = { ...manifest.frames, ...part.manifest.frames };
      Object.assign(manifest, part.manifest, { frames });
      Object.assign(textures, part.textures);
    }
    return { manifest, textures };
  }
  const response = await fetch(assetURL(`${group}/manifest.json`));
  if (!response.ok)
    throw new Error(`Failed to load asset group ${group}: ${response.status}`);
  const manifest = (await response.json()) as AssetManifest;
  // Finish loading sources before creating views, so failed loads leave no partial crops.
  const paths = [
    ...new Set(Object.values(manifest.frames).map((entry) => entry.image)),
  ];
  const sources = new Map(
    await Promise.all(
      paths.map(async (path) => [path, await loadImage(path)] as const),
    ),
  );
  const textures = Object.fromEntries(
    Object.entries(manifest.frames).map(([id, entry]) => [
      id,
      crop(sources.get(entry.image)!, entry),
    ]),
  );
  return { manifest, textures };
}

/** Shared resources belong to this module, never to individual scenes or sprites. */
export function loadGroup(group: AssetGroup): Promise<LoadedGroup> {
  if (unloading) return unloading.then(() => loadGroup(group));
  let pending = loading.get(group);
  if (!pending) {
    pending = load(group).catch((error: unknown) => {
      loading.delete(group);
      throw error;
    });
    loading.set(group, pending);
  }
  return pending;
}

export function squareTexture(
  entry: FrameDefinition,
  source: Texture,
): Texture {
  const key = JSON.stringify([entry.image, entry.frame]);
  let texture = squareTextures.get(key);
  if (!texture) {
    texture = crop(source, entry, true);
    squareTextures.set(key, texture);
  }
  return texture;
}

/** Call only after all views using these assets are destroyed. */
export function unloadAllAssets(): Promise<void> {
  if (unloading) return unloading;
  unloading = (async () => {
    await Promise.allSettled([...loading.values()]);
    await Promise.allSettled([...images.values()]);
    for (const texture of ownedTextures) texture.destroy(false);
    ownedTextures.clear();
    squareTextures.clear();
    loading.clear();
    const paths = [...images.keys()];
    images.clear();
    await Promise.all(paths.map((path) => Assets.unload(assetURL(path))));
  })().finally(() => {
    unloading = undefined;
  });
  return unloading;
}
