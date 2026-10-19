import { Position } from "../position.js";
import type { BattleContext } from "../battle.js";
import type { Unit } from "./unit.js";
import type { SpawnUnit } from "../spawn.js";

export function spawnUnits(ctx: BattleContext): void {
  const { player, units, gameData } = ctx;
  const visionRange = gameData.config.map.visionRange;
  const pendingSpawns: SpawnUnit[] = [];
  for (const unit of ctx.pendingSpawns) {
    if (unit.position.x <= player.position.x + visionRange.right) {
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

export function resolveCollisions(ctx: BattleContext): void {
  const units = [...ctx.units].filter((unit) => !unit.isDead);
  const displacements = units.map(() => ({ x: 0, y: 0 }));

  // Accumulate every pair against the original positions before moving anyone.
  for (let i = 0; i < units.length; i++) {
    const a = units[i]!;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j]!;
      const distance = Position.distance(a.position, b.position);
      const overlap = a.collisionRadius + b.collisionRadius - distance;
      if (overlap <= 0) continue;

      // Coincident centers need a stable direction to separate.
      const direction =
        distance === 0
          ? { x: b === ctx.player ? -1 : 1, y: 0 }
          : Position.direction(a.position, b.position);
      const aDistance =
        a === ctx.player ? 0 : overlap * (b === ctx.player ? 1 : 0.5);
      const bDistance =
        b === ctx.player ? 0 : overlap * (a === ctx.player ? 1 : 0.5);
      displacements[i]!.x -= direction.x * aDistance;
      displacements[i]!.y -= direction.y * aDistance;
      displacements[j]!.x += direction.x * bDistance;
      displacements[j]!.y += direction.y * bDistance;
    }
  }

  for (let i = 0; i < units.length; i++) {
    const displacement = displacements[i]!;
    const unit = units[i]!;
    unit.position = {
      x: unit.position.x + displacement.x,
      y: unit.position.y + displacement.y,
    };
  }
}

export function fixPosition(ctx: BattleContext): void {
  resolveCollisions(ctx);

  const { visionRange } = ctx.gameData.config.map;
  const minX = ctx.player.position.x - visionRange.left;
  const maxX = ctx.player.position.x + visionRange.right;
  for (const unit of ctx.units) {
    unit.position = {
      x: Math.max(minX, Math.min(maxX, unit.position.x)),
      y: Math.max(
        -visionRange.top,
        Math.min(visionRange.bottom, unit.position.y),
      ),
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

  if (targetingRange === undefined) return;

  const distanceToMove = Math.min(
    unit.rawStatus.attributes.speed ?? 0,
    Math.max(0, nearestDistance - targetingRange),
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
