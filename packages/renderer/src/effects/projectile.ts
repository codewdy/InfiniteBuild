import { Sprite } from "pixi.js";
import type { EffectFactory } from "./types.js";

export const createProjectile: EffectFactory = (
  event,
  context,
  duration,
  frames,
) => {
  const { from, to, projectileSpeed } = event.payload;
  if (
    typeof from !== "number" ||
    !Number.isSafeInteger(from) ||
    typeof to !== "number" ||
    !Number.isSafeInteger(to) ||
    typeof projectileSpeed !== "number" ||
    !Number.isFinite(projectileSpeed) ||
    projectileSpeed <= 0
  )
    return;
  const target =
    context.log.units.find((unit) => unit.id === to) ??
    context.previous?.units.find((unit) => unit.id === to);
  if (!target) return;
  const origin =
    context.log.units.find((unit) => unit.id === from) ??
    context.previous?.units.find((unit) => unit.id === from);
  if (!origin) return;
  const startPosition = origin.position;
  const direction = Math.sign(target.position - startPosition);
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.75, 0.5);
  let elapsed = 0;
  let verticalProgress = 0;
  return {
    sprite,
    start: context.log.frame,
    duration,
    update(_t, { x, targetPosition: position, elapsedFrames }) {
      const targetPosition = position(to);
      if (targetPosition === undefined) return true;
      elapsedFrames = Math.max(elapsed, elapsedFrames);
      // Capture the origin and direction once so source movement cannot drag the projectile.
      const projectilePosition =
        startPosition + direction * projectileSpeed * elapsedFrames;
      if (
        (direction === 0 && elapsedFrames >= 1) ||
        (direction !== 0 &&
          elapsedFrames > 0 &&
          Math.sign(targetPosition - projectilePosition) !== direction)
      )
        return true;

      const previousPosition =
        startPosition + direction * projectileSpeed * elapsed;
      const travel = projectileSpeed * (elapsedFrames - elapsed);
      const distance = Math.abs(targetPosition - previousPosition);
      const progress = distance === 0 ? 1 : Math.min(1, travel / distance);
      const sourceY = context.unitY(origin.id, origin.kind);
      const targetY = context.unitY(to, target.kind);
      const y = sourceY + (targetY - sourceY) * verticalProgress;
      sprite.rotation = Math.atan2(
        targetY - y,
        x(targetPosition) - x(previousPosition),
      );
      verticalProgress += (1 - verticalProgress) * progress;
      elapsed = elapsedFrames;
      sprite.scale.set(0.16 * context.unitScale);
      sprite.texture = frames[Math.floor(elapsed) % frames.length]!;
      sprite.position.set(
        Math.round(x(projectilePosition)),
        Math.round(sourceY + (targetY - sourceY) * verticalProgress),
      );
      return false;
    },
  };
};
