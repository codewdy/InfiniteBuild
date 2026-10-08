import { Sprite } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createAttack: EffectFactory = (event, context, duration) => {
  const { from, to } = event.payload;
  if (typeof from !== "number" || !Number.isFinite(from) ||
      typeof to !== "number" || !Number.isSafeInteger(to)) return;
  const target = context.log.units.find(unit => unit.id === to)
    ?? context.previous?.units.find(unit => unit.id === to);
  if (!target) return;
  const frames = context.assets.attack;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.5);
  const targetY = context.unitY(to, target.kind);
  let targetPosition = target.position;
  return {
    sprite, start: context.log.frame, duration,
    update(t, { x, targetPosition: position }) {
      targetPosition = position(to) ?? targetPosition;
      sprite.texture = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))]!;
      sprite.position.set(Math.round(x(targetPosition)), Math.round(targetY));
      sprite.rotation = x(targetPosition) >= x(from) ? -Math.PI / 4 : Math.PI / 4;
      sprite.width = 34 + 12 * t;
      sprite.height = sprite.width * sprite.texture.orig.height / sprite.texture.orig.width;
      sprite.alpha = 1 - t;
    },
  };
};
