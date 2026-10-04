import type { BattleContext } from "../battle.js";
import type { Unit } from "../unit.js";
import { Status } from "../status.js";

export namespace CombatResolver {
  export function updateStatus(ctx: BattleContext, unit: Unit): void {
    const status = unit.calcBaseStatus(ctx);
    unit.status = status;
    unit.rawStatus = Status.resolve(unit.status);
    if (unit.rawStatus.maxHp != unit.maxHp) {
      unit.hp = (unit.hp * unit.rawStatus.maxHp) / unit.maxHp;
      unit.maxHp = unit.rawStatus.maxHp;
    }
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
  export function cast(ctx: BattleContext, unit: Unit, skill: string): void {
    const definition = ctx.gameData.skillDefinitions[skill];
    if (!definition) throw new Error(`Unknown skill: ${skill}`);
    ctx.taskScheduler.start(() => definition.caster(unit, ctx));
  }
  export function hit(
    ctx: BattleContext,
    src: Unit,
    dst: Unit,
    amount?: number,
  ): boolean {
    if (amount !== undefined) {
      damage(ctx, src, dst, amount);
    }
    dst.lastHitUnit = src;
    return true;
  }
  export function damage(
    ctx: BattleContext,
    src: Unit | null,
    dst: Unit,
    amount: number,
  ): void {
    dst.hp -= amount;
    ctx.events.addDamage({ dst: dst.id, damage: amount });
  }
  export function resolveDeath(ctx: BattleContext): void {
    while (true) {
      const death = [];
      for (const unit of [...ctx.units]) {
        if (unit.hp <= 0) {
          if (!unit.isDead) {
            unit.isDead = true;
          }
          ctx.units.remove(unit);
          death.push(unit);
        }
      }
      for (const unit of death) {
        unit.onDeath(ctx);
      }
      for (const unit of death) {
        if (unit.lastHitUnit != null) {
          unit.lastHitUnit.onKill(ctx, unit);
        }
      }
      if (death.length == 0) {
        break;
      }
    }
  }
}
