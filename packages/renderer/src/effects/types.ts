import type { BattleEvent, BattleLog } from "@infinite-build/core";
import type { Sprite, Texture } from "pixi.js";
import type { BattlefieldAssets } from "@infinite-build/assets";

export type EffectDrawContext = {
  elapsedFrames: number;
  x: (position: number) => number;
  targetPosition: (id: number) => number | undefined;
};

export type SkillEffect = {
  sprite: Sprite;
  start: number;
  duration: number;
  /** Return true when the effect has finished and can be destroyed. */
  update: (progress: number, context: EffectDrawContext) => boolean | void;
};

export type EffectCreateContext = {
  assets: BattlefieldAssets;
  log: BattleLog;
  previous?: BattleLog;
  sourceY: number;
  unitScale: number;
  unitY: (id: number, kind: string) => number;
};

export type EffectFactory = (
  event: BattleEvent.Effect,
  context: EffectCreateContext,
  duration: number,
  frames: Texture[],
) => SkillEffect | undefined;
