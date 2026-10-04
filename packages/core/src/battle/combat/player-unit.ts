import { Unit } from "./unit.js";
import { move } from "./movement.js";
import type { BattleContext } from "../battle.js";
import { Status } from "./status.js";
export class PlayerUnit extends Unit {
  constructor() {
    super();
    this.kind = "Player";
    this.faction = "Ally";
    this.position = 0;
  }
  onBuildChanged(ctx: BattleContext): void {
    this.skills = ctx.build.skills;
  }
  override calcBaseStatus(ctx: BattleContext): Status.Status {
    return Status.createByConfig({ attributes: { maxHp: 10 } });
  }
  override onMove(ctx: BattleContext): void {
    const { speed, range, count, safeRange } = ctx.build.move;
    const visionRange = ctx.gameData.config.map.visionRange;
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

    enemyPositions.sort((a, b) => a - b);
    const nearestPosition = enemyPositions[0];
    const safeMoveDistance =
      nearestPosition === undefined
        ? speed
        : Math.min(
            speed,
            Math.max(0, nearestPosition - this.position - safeRange),
          );

    if (enemyPositions.length < count && ctx.pendingSpawns.length > 0) {
      move(ctx, this, 1, safeMoveDistance);
      return;
    }
    if (enemyPositions.length === 0 || count <= 0) return;

    const targetPosition =
      enemyPositions[Math.min(count, enemyPositions.length) - 1]!;
    const distanceToMove = Math.min(
      safeMoveDistance,
      Math.max(0, targetPosition - this.position - range),
    );
    move(ctx, this, 1, distanceToMove);
  }
  override onUpdate(ctx: BattleContext): void {
    super.onUpdate(ctx);
    for (const { uuid, skill, castRate } of this.skills.onUpdate ?? []) {
      const progress = castRate === undefined ? 0 : (this.skillProgress.get(uuid) ?? 0);
      ctx.events.addPlayerSkillProgress({ uuid, skill, castRate: castRate ?? 1, progress });
    }
  }
}
