import { Position } from "@infinite-build/core";
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
  let projectilePosition = origin.position;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.75, 0.5);
  let elapsed = 0;
  return {
    sprite,
    start: context.log.frame,
    duration,
    update(_t, { x, y, targetPosition: position, elapsedFrames }) {
      const targetPosition = position(to);
      if (targetPosition === undefined) return true;
      elapsedFrames = Math.max(elapsed, elapsedFrames);
      const travel = projectileSpeed * (elapsedFrames - elapsed);
      const distance = Position.distance(projectilePosition, targetPosition);
      if (elapsedFrames >= 1 && distance <= travel) return true;
      const direction = Position.direction(projectilePosition, targetPosition);
      sprite.rotation = Math.atan2(
        y(targetPosition) - y(projectilePosition),
        x(targetPosition) - x(projectilePosition),
      );
      projectilePosition = Position.translate(
        projectilePosition,
        direction,
        Math.min(travel, distance),
      );
      elapsed = elapsedFrames;
      sprite.scale.set(0.16 * context.unitScale);
      sprite.texture = frames[Math.floor(elapsed) % frames.length]!;
      sprite.position.set(
        Math.round(x(projectilePosition)),
        Math.round(y(projectilePosition)),
      );
      return false;
    },
  };
};
