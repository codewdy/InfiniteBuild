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
  let targetPosition = target.position;
  let direction = Position.direction(projectilePosition, targetPosition);
  let targetLost = false;
  let fadeStartedAt: number | undefined;
  const fadeFrames = 3;
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.75, 0.5);
  let elapsed = 0;
  return {
    sprite,
    start: context.log.frame,
    duration: duration + fadeFrames,
    update(_t, { x, y, targetPosition: position, elapsedFrames }) {
      elapsedFrames = Math.max(elapsed, elapsedFrames);
      if (!targetLost) {
        const trackedPosition = position(to);
        if (trackedPosition === undefined) {
          targetLost = true;
          fadeStartedAt ??= elapsedFrames;
        } else targetPosition = trackedPosition;
      }
      const travel = projectileSpeed * (elapsedFrames - elapsed);
      const distance = Position.distance(projectilePosition, targetPosition);
      if (fadeStartedAt === undefined) {
        if (elapsedFrames >= 1 && distance <= travel) {
          return true;
        } else if (elapsedFrames >= duration) {
          fadeStartedAt = duration;
        }
      }
      const fade =
        fadeStartedAt === undefined
          ? 0
          : Math.min(1, (elapsedFrames - fadeStartedAt) / fadeFrames);
      if (fade >= 1) return true;
      if (!targetLost) {
        direction = Position.direction(projectilePosition, targetPosition);
      }
      const heading = Position.translate(projectilePosition, direction, 1);
      sprite.rotation = Math.atan2(
        y(heading) - y(projectilePosition),
        x(heading) - x(projectilePosition),
      );
      projectilePosition = Position.translate(
        projectilePosition,
        direction,
        targetLost
          ? travel
          : Math.min(
              projectileSpeed *
                (Math.min(elapsedFrames, duration) -
                  Math.min(elapsed, duration)),
              distance,
            ),
      );
      elapsed = elapsedFrames;
      sprite.alpha = 1 - fade;
      sprite.scale.set(0.16 * context.unitScale * (1 - fade * 0.7));
      sprite.texture = frames[Math.floor(elapsed) % frames.length]!;
      sprite.position.set(
        Math.round(x(projectilePosition)),
        Math.round(y(projectilePosition)),
      );
      return false;
    },
  };
};
