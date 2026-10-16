import { Position } from "@infinite-build/core";
import { Sprite } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createWave: EffectFactory = (event, context, duration, frames) => {
  const { center, radius } = event.payload;
  if (
    !Position.is(center) ||
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius < 0
  )
    return;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.5);
  return {
    sprite,
    start: context.log.frame,
    duration,
    update(t, { x, y }) {
      const progress = Math.max(0, Math.min(1, t));
      sprite.texture =
        frames[
          Math.min(frames.length - 1, Math.floor(progress * frames.length))
        ]!;
      // Project the circular damage radius into screen coordinates.
      const pixels = Math.abs(
        x({ x: center.x + radius * progress, y: center.y }) - x(center),
      );
      const verticalPixels = Math.abs(
        y({ x: center.x, y: center.y + radius * progress }) - y(center),
      );
      sprite.position.set(Math.round(x(center)), Math.round(y(center)));
      const scale = (pixels * 2) / sprite.texture.orig.width;
      sprite.scale.set(
        scale,
        (verticalPixels * 2) / sprite.texture.orig.height,
      );
      const entrance = Math.min(1, progress / 0.08);
      sprite.alpha =
        0.65 * entrance * (2 - entrance) * Math.pow(1 - progress, 0.85);
    },
  };
};
