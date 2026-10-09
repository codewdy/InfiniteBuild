import { Sprite } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createNova: EffectFactory = (event, context, duration) => {
  const { center, radius } = event.payload;
  if (typeof center !== "number" || !Number.isFinite(center) ||
      typeof radius !== "number" || !Number.isFinite(radius) || radius < 0) return;
  const frames = context.assets.nova;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.5);
  return {
    sprite, start: context.log.frame, duration,
    update(t, { x }) {
      const progress = Math.max(0, Math.min(1, t));
      sprite.texture = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))]!;
      // Keep horizontal propagation aligned with the skill's damage wave.
      const pixels = Math.abs(x(center + radius * progress) - x(center));
      sprite.position.set(Math.round(x(center)), Math.round(context.sourceY + 18 * context.unitScale));
      const scale = pixels * 2 / sprite.texture.orig.width;
      sprite.scale.set(scale, scale * 0.32);
      const entrance = Math.min(1, progress / 0.08);
      sprite.alpha = 0.65 * entrance * (2 - entrance) * Math.pow(1 - progress, 0.85);
    },
  };
};
