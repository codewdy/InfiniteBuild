import type { Position } from "@infinite-build/core";
import type { BattleEvent, BattleLog } from "@infinite-build/core";
import type { Container, Texture } from "pixi.js";
import type { BattlefieldAssets } from "@infinite-build/assets";

export type EffectDrawContext = {
  elapsedFrames: number;
  x: (position: Position) => number;
  y: (position: Position) => number;
  targetPosition: (id: number) => Position | undefined;
};

export type SkillEffect = {
  sprite: Container;
  start: number;
  duration: number;
  /** Return true when the effect has finished and can be destroyed. */
  update: (progress: number, context: EffectDrawContext) => boolean | void;
};

export type EffectCreateContext = {
  assets: BattlefieldAssets;
  log: BattleLog;
  previous?: BattleLog;
  unitScale: number;
};

export type EffectFactory = (
  event: BattleEvent.Effect,
  context: EffectCreateContext,
  duration: number,
  frames: Texture[],
) => SkillEffect | undefined;
