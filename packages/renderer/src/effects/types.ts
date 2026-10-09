import type { BattleEvent, BattleLog } from "@infinite-build/core";
import type { Sprite } from "pixi.js";
import type { BattlefieldAssets } from "../battlefield-assets.js";

export type EffectDrawContext = {
  x: (position: number) => number;
  targetPosition: (id: number) => number | undefined;
};

export type SkillEffect = {
  sprite: Sprite;
  start: number;
  duration: number;
  update: (progress: number, context: EffectDrawContext) => void;
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
) => SkillEffect | undefined;
