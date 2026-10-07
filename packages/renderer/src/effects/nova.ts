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
      sprite.texture = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))]!;
      const pixels = Math.abs(x(center + radius * t) - x(center));
      sprite.position.set(Math.round(x(center)), Math.round(context.sourceY));
      sprite.scale.set(pixels * 2 / sprite.texture.orig.width);
      sprite.alpha = 0.75 * Math.pow(1 - t, 0.8);
    },
  };
};
