import type { EffectVisual } from "./visuals.js";
import type { Texture } from "pixi.js";
export type CharacterAnimation =
  "idle" | "walk" | "cast" | "attack" | "hit" | "death";
export type CharacterClip = {
  frames: Texture[];
  durationMs: number;
  loop: boolean;
};
export type CharacterTextures = {
  scale: number;
  animations: Record<CharacterAnimation, CharacterClip>;
};
export type SupportDirectionIconName =
  `support-${"distant" | "line" | "opposite" | "diagonal" | "diagonalPair"}-${"magic" | "rare"}`;
export type IconName = string;
export type IconAsset = {
  image: string;
  frame: [number, number, number, number];
  imageWidth: number;
  imageHeight: number;
};
export type SettlementAssets = {
  emblems: Record<"Victory" | "Defeat", Texture>;
  rewards: Record<
    | "skill"
    | "passive"
    | "support-skill"
    | "support-passive"
    | "pending"
    | "xp",
    Texture
  >;
};
export type BattlefieldAssets = {
  progressFrame: Texture;
  playbackIcons: Record<"pause" | "resume", Texture>;
  backgrounds: Record<string, Texture>;
  characters: Record<string, CharacterTextures>;
  effects: Record<string, Texture[]>;
  effectVisuals: Record<string, EffectVisual>;
  castAnimations: Record<string, "cast" | "attack">;
  defaultSkillIcon: Texture;
  icons: Record<IconName, IconAsset>;
  affixIcons: Record<string, IconAsset>;
  skillTablets: Record<string, Texture>;
  settlement: SettlementAssets;
};
export type DrawerAssets = {
  board: Texture;
  inventory: Texture;
  inventoryWide: Texture;
  background: Texture;
  playerHandle: Texture;
  randomSkill: { normal: Texture; magic: Texture; rare: Texture };
  tabs: { tablets: Texture; loot: Texture };
};
