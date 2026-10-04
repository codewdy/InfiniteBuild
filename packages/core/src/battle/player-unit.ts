import { Unit } from "./unit.js";
import { CombatResolver } from "./combat/combat-resolver.js";
import type { BattleContext } from "./battle.js";
import { Status } from "./status.js";
export class PlayerUnit extends Unit {
  private skillProgress = new Map<string, number>();
  constructor() {
    super();
    this.kind = "Player";
    this.faction = "Ally";
    this.position = 0;
  }
  onBuildChanged(ctx: BattleContext): void {}
  override calcBaseStatus(ctx: BattleContext): Status.Status {
    return Status.createByConfig({ maxHp: 10 });
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
      CombatResolver.move(ctx, this, 1, safeMoveDistance);
      return;
    }
    if (enemyPositions.length === 0 || count <= 0) return;

    const targetPosition =
      enemyPositions[Math.min(count, enemyPositions.length) - 1]!;
    const distanceToMove = Math.min(
      safeMoveDistance,
      Math.max(0, targetPosition - this.position - range),
    );
    CombatResolver.move(ctx, this, 1, distanceToMove);
  }
  override onUpdate(ctx: BattleContext): void {
    for (const { uuid, skill, castRate } of ctx.build.skills) {
      let progress = (this.skillProgress.get(uuid) ?? 0) + castRate;
      while (progress >= 1) {
        progress -= 1;
        CombatResolver.cast(ctx, this, skill);
      }
      this.skillProgress.set(uuid, progress);
      ctx.events.addPlayerSkillProgress({ uuid, skill, castRate, progress });
    }
  }
  override onDeath(ctx: BattleContext): void {}
  override onHitDealt(ctx: BattleContext, dst: Unit, amount: number): void {}
  override onHitReceived(ctx: BattleContext, src: Unit, amount: number): void {}
  override onDamageDealt(ctx: BattleContext, dst: Unit, amount: number): void {}
  override onDamageReceived(
    ctx: BattleContext,
    src: Unit | null,
    amount: number,
  ): void {}
  override onHeal(ctx: BattleContext, src: Unit | null, amount: number): void {}
  override onKill(ctx: BattleContext, dst: Unit): void {}
}
