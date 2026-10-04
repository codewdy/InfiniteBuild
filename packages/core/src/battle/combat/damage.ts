import type { BattleContext } from "../battle.js";
import type { Unit } from "./unit.js";

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
  src.onHitDealt(ctx, dst, amount ?? 0);
  dst.onHitReceived(ctx, src, amount ?? 0);
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
  src?.onDamageDealt(ctx, dst, amount);
  dst.onDamageReceived(ctx, src, amount);
}
