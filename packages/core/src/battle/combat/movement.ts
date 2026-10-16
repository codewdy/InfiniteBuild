import { Position } from "../position.js";
import type { BattleContext } from "../battle.js";
import type { Unit } from "./unit.js";

export function spawnUnits(ctx: BattleContext): void {
  const { player, units, gameData } = ctx;
  const visionRange = gameData.config.map.visionRange;
  const pendingSpawns: Unit[] = [];
  for (const unit of ctx.pendingSpawns) {
    if (unit.position.x <= player.position.x + visionRange.x) {
      units.add(unit);
    } else {
      pendingSpawns.push(unit);
    }
  }
  ctx.pendingSpawns = pendingSpawns;
}

export function move(
  ctx: BattleContext,
  unit: Unit,
  direction: Position,
  distance: number,
): void {
  if (unit.isDead || distance <= 0) return;
  direction = Position.normalize(direction);
  if (direction.x === 0 && direction.y === 0) return;
  unit.position = Position.translate(unit.position, direction, distance);
  ctx.events.addMove({ unit: unit.id, direction, distance });
}

export function fixPosition(ctx: BattleContext): void {
  const { visionRange } = ctx.gameData.config.map;
  const minX = ctx.player.position.x;
  const maxX = minX + visionRange.x;
  const halfHeight = visionRange.y / 2;
  for (const unit of ctx.units) {
    unit.position = {
      x: Math.max(minX, Math.min(maxX, unit.position.x)),
      y: Math.max(0 - halfHeight, Math.min(halfHeight, unit.position.y)),
    };
  }
}

export function moveBySkillRange(ctx: BattleContext, unit: Unit): void {
  if (unit.isDead) return;
  let nearestTarget: Unit | undefined;
  let nearestDistance = Infinity;
  for (const target of ctx.units) {
    if (target.faction === unit.faction || target.isDead) continue;
    const distance = Position.distance(unit.position, target.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTarget = target;
    }
  }
  if (!nearestTarget) return;

  let targetingRange: number | undefined;
  for (const skills of Object.values(unit.skillTrigger.skills)) {
    for (const skill of skills) {
      if (!skill.targetingRange) continue;
      const range = skill.targetingRange(ctx, unit, skill);
      targetingRange =
        targetingRange === undefined ? range : Math.min(targetingRange, range);
    }
  }

  const distanceToMove = Math.min(
    unit.rawStatus.attributes.speed ?? 0,
    Math.max(0, nearestDistance - (targetingRange ?? 0)),
  );
  if (distanceToMove > 0) {
    move(
      ctx,
      unit,
      Position.direction(unit.position, nearestTarget.position),
      distanceToMove,
    );
  }
}
