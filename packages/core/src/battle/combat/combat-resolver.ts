import type { BattleContext } from "../battle.js";
import type { Unit } from "../unit.js";
import { Status } from "../status.js";

export namespace CombatResolver {
  export function updateStatus(ctx: BattleContext, unit: Unit): void {
    let status = unit.calcBaseStatus(ctx);
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
  export function cast(ctx: BattleContext, unit: Unit, skill: string): void {
    const definition = ctx.gameData.skillDefinitions[skill];
    if (!definition) throw new Error(`Unknown skill: ${skill}`);
    ctx.taskScheduler.start(() => definition.caster(unit, ctx));
  }
  export function hit(
    ctx: BattleContext,
    src: Unit,
    dst: Unit,
    amount: number,
  ): boolean {
    damage(ctx, src, dst, amount);
    return true;
  }
  export function damage(
    ctx: BattleContext,
    src: Unit | void,
    dst: Unit,
    amount: number,
  ) {
    dst.hp -= amount;
    ctx.events.addDamage({ dst: dst.id, damage: amount });
  }
}
