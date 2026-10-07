import type { BattleEvent } from "@infinite-build/core";
import { createFireball } from "./fireball.js";
import { createNova } from "./nova.js";
import type { EffectCreateContext, EffectFactory, SkillEffect } from "./types.js";

// Add new effect factories here; the battlefield only handles their lifecycle.
const factories: Readonly<Record<string, EffectFactory>> = {
  fireball: createFireball,
  nova: createNova,
};

export function createSkillEffect(event: BattleEvent.Effect, context: EffectCreateContext): SkillEffect | undefined {
  const duration = event.payload.durationFrames;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return;
  const factory = Object.hasOwn(factories, event.effect) ? factories[event.effect] : undefined;
  return factory?.(event, context, duration);
}

export type { SkillEffect, EffectFactory, EffectCreateContext, EffectDrawContext } from "./types.js";
