import type { BattleContext } from "../battle.js";
import type { Unit } from "./unit.js";
import { Status } from "./status.js";

export function updateStatus(ctx: BattleContext, unit: Unit): void {
  // stack reserves one extra frame so advancing first preserves the requested duration.
  unit.buffs.update();
  const modifiers = unit.buffs.getModifiers();
  const status = Status.apply(unit.calcBaseStatus(ctx), modifiers);
  unit.status = status;
  unit.rawStatus = Status.resolve(unit.status);
  if (unit.rawStatus.attributes.maxHp != unit.maxHp) {
    unit.hp = (unit.hp * unit.rawStatus.attributes.maxHp) / unit.maxHp;
    unit.maxHp = unit.rawStatus.attributes.maxHp;
  }
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
