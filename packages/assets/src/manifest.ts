import type {
  CharacterAnimation,
  IconName,
  SettlementAssets,
} from "./types.js";

export const groups = [
  "characters",
  "backgrounds",
  "effects",
  "tablets",
  "battle-ui",
  "ui",
] as const;
export type ManifestGroup = (typeof groups)[number];
export type AssetGroup = ManifestGroup | "battle";
export type FrameDefinition = {
  image: string;
  frame: [number, number, number, number];
  size: [number, number];
  alignment: "feet" | "center";
  offset?: [number, number];
};
export type AssetManifest = Partial<Omit<BattleManifest, "frames">> & {
  frames: Record<string, FrameDefinition>;
  ui?: Record<string, string>;
};

export type BattleManifest = {
  progressFrame: string;
  playbackIcons: Record<"pause" | "resume", string>;
  backgrounds: Record<string, string>;
  frames: Record<string, FrameDefinition>;
  characters: Record<
    string,
    {
      scale: number;
      animations: Record<
        CharacterAnimation,
        { frames: string[]; durationMs: number; loop: boolean }
      >;
    }
  >;
  effects: { fireball: string[]; nova: string[]; attack: string[] };
  icons: Record<IconName, string>;
  affixIcons: Record<string, string>;
  skillTablets: Record<string, string>;
  settlement: {
    [K in keyof SettlementAssets]: Record<keyof SettlementAssets[K], string>;
  };
};
