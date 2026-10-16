import { Graphics } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createLightning: EffectFactory = (event, context, duration) => {
  const { from, to } = event.payload;
  if (
    typeof from !== "number" ||
    !Number.isSafeInteger(from) ||
    typeof to !== "number" ||
    !Number.isSafeInteger(to)
  )
    return;
  const origin =
    context.log.units.find((unit) => unit.id === from) ??
    context.previous?.units.find((unit) => unit.id === from);
  const target =
    context.log.units.find((unit) => unit.id === to) ??
    context.previous?.units.find((unit) => unit.id === to);
  if (!origin || !target) return;

  const sprite = new Graphics();
  return {
    sprite,
    start: context.log.frame,
    duration,
    update(t, { x, y, targetPosition }) {
      const startX = x(targetPosition(from) ?? origin.position);
      const startY = y(targetPosition(from) ?? origin.position);
      const endX = x(targetPosition(to) ?? target.position);
      const endY = y(targetPosition(to) ?? target.position);
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.hypot(dx, dy) || 1;
      const scale = context.unitScale;
      const segments = 10;
      const points = Array.from({ length: segments + 1 }, (_, i) => {
        const progress = i / segments;
        const offset =
          i === 0 || i === segments
            ? 0
            : Math.sin(i * 12.9898 + from * 0.7 + to) *
              Math.min(12 * scale, length * 0.15);
        return {
          x: startX + dx * progress - (dy / length) * offset,
          y: startY + dy * progress + (dx / length) * offset,
        };
      });
      sprite.clear();
      sprite.alpha = Math.max(0, 1 - t);
      for (const [width, color, alpha] of [
        [9 * scale, 0x4488ff, 0.25],
        [3 * scale, 0x77ddff, 0.9],
        [1 * scale, 0xffffff, 1],
      ]) {
        sprite.moveTo(startX, startY);
        for (const point of points.slice(1)) sprite.lineTo(point.x, point.y);
        sprite.stroke({ width, color, alpha });
      }
    },
  };
};
