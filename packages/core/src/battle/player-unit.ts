import type { Unit } from "./unit.js";
import type { BattleContext, Faction } from "./battle.js";
export class PlayerUnit implements Unit {
  id: number = -1;
  kind: string;
  faction: Faction = "Ally";
  position: number;
  hp: number;
  constructor() {
    this.kind = "Player";
    this.position = 0;
    this.hp = 1; // just mock
  }
  move(ctx: BattleContext): void {
    const { speed, range, count } = ctx.ctx.playerState.move;
    const visionRange = ctx.ctx.gameData.config.map.visionRange;
    const enemyPositions: number[] = [];
    for (const unit of ctx.units) {
      const distance = unit.position - this.position;
      if (
        unit.faction !== this.faction &&
        distance >= 0 &&
        distance <= visionRange
      ) {
        enemyPositions.push(unit.position);
      }
    }

    if (enemyPositions.length < count && ctx.pendingSpawns.length > 0) {
      this.position += speed;
      return;
    }
    if (enemyPositions.length === 0) return;

    enemyPositions.sort((a, b) => a - b);
    const targetPosition =
      enemyPositions[Math.min(count, enemyPositions.length) - 1]!;
    const distanceToMove = Math.min(
      speed,
      Math.max(0, targetPosition - this.position - range),
    );
    this.position += distanceToMove;
  }
  onUpdate(ctx: BattleContext): void {}
}
