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
