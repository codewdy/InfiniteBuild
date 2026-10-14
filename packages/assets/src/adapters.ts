import type { BattleManifest } from "./manifest.js";
import type { Texture } from "pixi.js";
import { assetURL, loadGroup } from "./loader.js";
import type {
  BattlefieldAssets,
  CharacterTextures,
  IconAsset,
  IconName,
  SettlementAssets,
  DrawerAssets,
} from "./types.js";

export async function loadBattlefieldAssets(): Promise<BattlefieldAssets> {
  const { manifest: data, textures } = await loadGroup("battle");
  const manifest = data as BattleManifest;
  const texture = (name: string): Texture => {
    const result = textures[name];
    if (!result) throw new Error(`Missing battle texture: ${name}`);
    return result;
  };
  const iconAsset = (key: string): IconAsset => {
    const entry = manifest.frames[key]!;
    const source = texture(key).source;
    return {
      image: assetURL(entry.image!),
      frame: entry.frame,
      imageWidth: source.width,
      imageHeight: source.height,
    };
  };
  return {
    progressFrame: texture(manifest.progressFrame),
    playbackIcons: {
      pause: texture(manifest.playbackIcons.pause),
      resume: texture(manifest.playbackIcons.resume),
    },
    backgrounds: Object.fromEntries(
      Object.entries(manifest.backgrounds).map(([name, id]) => [
        name,
        texture(id),
      ]),
    ),
    characters: Object.fromEntries(
      Object.entries(manifest.characters).map(([kind, poses]) => [
        kind,
        {
          scale: poses.scale,
          animations: Object.fromEntries(
            Object.entries(poses.animations).map(([name, clip]) => {
              if (
                !clip.frames.length ||
                !Number.isFinite(clip.durationMs) ||
                clip.durationMs <= 0
              ) {
                throw new Error(`Invalid character animation: ${kind}.${name}`);
              }
              return [name, { ...clip, frames: clip.frames.map(texture) }];
            }),
          ) as CharacterTextures["animations"],
        },
      ]),
    ),
    fireball: manifest.effects.fireball.map(texture),
    nova: manifest.effects.nova.map(texture),
    attack: manifest.effects.attack.map(texture),
    skillTablets: Object.fromEntries(
      Object.entries(manifest.skillTablets).map(([skill, name]) => [
        skill,
        texture(name),
      ]),
    ),
    icons: Object.fromEntries(
      Object.entries(manifest.icons).map(([name, key]) => [
        name,
        iconAsset(key),
      ]),
    ) as Record<IconName, IconAsset>,
    affixIcons: Object.fromEntries(
      Object.entries(manifest.affixIcons).map(([name, key]) => [
        name,
        iconAsset(key),
      ]),
    ),
    settlement: {
      emblems: Object.fromEntries(
        Object.entries(manifest.settlement.emblems).map(([kind, name]) => [
          kind,
          texture(name),
        ]),
      ) as SettlementAssets["emblems"],
      rewards: Object.fromEntries(
        Object.entries(manifest.settlement.rewards).map(([kind, name]) => [
          kind,
          texture(name),
        ]),
      ) as SettlementAssets["rewards"],
    },
  };
}

export async function loadDrawerAssets(): Promise<DrawerAssets> {
  const { manifest, textures } = await loadGroup("ui");
  const texture = (name: string): Texture => textures[manifest.ui![name]!]!;
  return {
    board: texture("board"),
    inventory: texture("inventory"),
    inventoryWide: texture("inventoryWide"),
    background: texture("background"),
    playerHandle: texture("playerHandle"),
    tabs: { tablets: texture("tabs.tablets"), loot: texture("tabs.loot") },
    randomSkill: {
      normal: texture("randomSkill.normal"),
      magic: texture("randomSkill.magic"),
      rare: texture("randomSkill.rare"),
    },
  };
}

async function loadIcons(
  field: "icons" | "affixIcons",
): Promise<Record<string, IconAsset>> {
  const { manifest, textures } = await loadGroup("tablets");
  return Object.fromEntries(
    Object.entries(manifest[field]!).map(([name, id]) => {
      const entry = manifest.frames[id]!;
      const source = textures[id]!.source;
      return [
        name,
        {
          image: assetURL(entry.image),
          frame: entry.frame,
          imageWidth: source.width,
          imageHeight: source.height,
        },
      ];
    }),
  );
}
export async function loadBattlefieldIcons(): Promise<
  Record<IconName, IconAsset>
> {
  return (await loadIcons("icons")) as Record<IconName, IconAsset>;
}
export const loadPassiveAffixIcons = (): Promise<Record<string, IconAsset>> =>
  loadIcons("affixIcons");
