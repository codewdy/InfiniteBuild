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
    !Number.isFinite(from) ||
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
  const sprite = new Sprite({ texture: frames[0]!, roundPixels: true });
  sprite.anchor.set(0.75, 0.5);
  let projectilePosition = from;
  let previousTargetPosition = target.position;
  let elapsed = 0;
  let verticalProgress = 0;
  return {
    sprite,
    start: context.log.frame,
    duration,
    update(_t, { x, targetPosition: position, elapsedFrames }) {
      const targetPosition = position(to);
      if (targetPosition === undefined) return true;
      const distance = targetPosition - projectilePosition;
      const travel = projectileSpeed * Math.max(0, elapsedFrames - elapsed);
      const crossedProjectile =
        Math.sign(previousTargetPosition - projectilePosition) !==
        Math.sign(distance);
      if (crossedProjectile || Math.abs(distance) <= travel) return true;

      const targetY = context.unitY(to, target.kind);
      const y =
        context.sourceY + (targetY - context.sourceY) * verticalProgress;
      sprite.rotation = Math.atan2(
        targetY - y,
        x(targetPosition) - x(projectilePosition),
      );
      projectilePosition += Math.sign(distance) * travel;
      verticalProgress +=
        (1 - verticalProgress) * (travel / Math.abs(distance));
      previousTargetPosition = targetPosition;
      elapsed = Math.max(elapsed, elapsedFrames);
      sprite.scale.set(0.16 * context.unitScale);
      sprite.texture = frames[Math.floor(elapsed) % frames.length]!;
      sprite.position.set(
        Math.round(x(projectilePosition)),
        Math.round(
          context.sourceY + (targetY - context.sourceY) * verticalProgress,
        ),
      );
      return false;
    },
  };
};
