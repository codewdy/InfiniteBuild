import type { EffectRenderer } from "@infinite-build/assets";
import type { BattleEvent } from "@infinite-build/core";
import { createProjectile } from "./projectile.js";
import { createWave } from "./wave.js";
import { createTargetStrike } from "./target-strike.js";
import type {
  EffectCreateContext,
  EffectFactory,
  SkillEffect,
} from "./types.js";

// Add new effect factories here; the battlefield only handles their lifecycle.
export const effectFactories: Readonly<Record<EffectRenderer, EffectFactory>> =
  {
    projectile: createProjectile,
    wave: createWave,
    "target-strike": createTargetStrike,
  };

export function createSkillEffect(
  event: BattleEvent.Effect,
  context: EffectCreateContext,
): SkillEffect | undefined {
  const visual = context.assets.effectVisuals[event.effect];
  if (!visual) return;
  // Projectiles end on arrival; only timed effects require durationFrames.
  const duration =
    visual.renderer === "projectile" ? Infinity : event.payload.durationFrames;
  if (
    typeof duration !== "number" ||
    (visual.renderer !== "projectile" && !Number.isFinite(duration)) ||
    duration <= 0
  )
    return;
  const frames = context.assets.effects[visual.frames];
  if (!frames?.length) return;
  const factory = effectFactories[visual.renderer];
  return factory?.(event, context, duration, frames);
}

export type {
  SkillEffect,
  EffectFactory,
  EffectCreateContext,
  EffectDrawContext,
} from "./types.js";
