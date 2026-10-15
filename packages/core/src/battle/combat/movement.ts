import type { BattleContext } from "../battle.js";
import type { Unit } from "./unit.js";

export function spawnUnits(ctx: BattleContext): void {
  const { player, units, gameData } = ctx;
  const visionRange = gameData.config.map.visionRange;
  const pendingSpawns: Unit[] = [];
  for (const unit of ctx.pendingSpawns) {
    if (Math.abs(unit.position - player.position) <= visionRange) {
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
  direction: number,
  distance: number,
): void {
  unit.position += direction * distance;
  ctx.events.addMove({ unit: unit.id, direction, distance });
}

export function fixPosition(ctx: BattleContext): void {
  const min = ctx.player.position;
  const max = min + ctx.gameData.config.map.visionRange;
  for (const unit of ctx.units) {
    unit.position = Math.max(min, Math.min(max, unit.position));
  }
}

export function moveBySkillRange(ctx: BattleContext, unit: Unit): void {
  const direction = unit.faction === "Ally" ? 1 : -1;
  let nearestDistance = Infinity;
  for (const target of ctx.units) {
    if (target.faction === unit.faction) continue;
    const distance = (target.position - unit.position) * direction;
    if (distance >= 0 && distance < nearestDistance) {
      nearestDistance = distance;
    }
  }
  if (nearestDistance === Infinity) return;

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
    move(ctx, unit, direction, distanceToMove);
  }
}
