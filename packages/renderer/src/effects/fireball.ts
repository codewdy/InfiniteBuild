import { Sprite } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createFireball: EffectFactory = (event, context, duration) => {
  const { from, to } = event.payload;
  if (typeof from !== "number" || !Number.isFinite(from) ||
      typeof to !== "number" || !Number.isSafeInteger(to)) return;
  const target = context.log.units.find(unit => unit.id === to)
    ?? context.previous?.units.find(unit => unit.id === to);
  if (!target) return;
  const frames = context.assets.fireball;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.75, 0.5);
  let targetPosition = target.position;
  return {
    sprite, start: context.log.frame, duration,
    update(t, { x, targetPosition: position }) {
      const targetY = context.unitY(to, target.kind);
      sprite.scale.set(0.16 * context.unitScale);
      targetPosition = position(to) ?? targetPosition;
      sprite.texture = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))]!;
      const y = context.sourceY + (targetY - context.sourceY) * t;
      sprite.position.set(Math.round(x(from + (targetPosition - from) * t)), Math.round(y));
      sprite.rotation = Math.atan2(targetY - context.sourceY, x(targetPosition) - x(from));
      sprite.alpha = 1 - t * 0.25;
    },
  };
};
