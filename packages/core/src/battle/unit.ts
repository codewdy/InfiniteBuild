import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  maxHp: number = 1;
  hp: number = 1;
  status: Status.RawStatus = Status.resolve(
    Status.createByConfig({ maxHp: 1 }),
  );

  updateStatus(ctx: BattleContext): void {
    let status = this.onUpdateStatus(ctx);
    this.status = Status.resolve(status);
    if (this.status.maxHp != this.maxHp) {
      this.hp = (this.hp * this.status.maxHp) / this.maxHp;
      this.maxHp = this.status.maxHp;
    }
  }
  damage(ctx: BattleContext, damage: number): void {
    this.hp -= damage;
    ctx.events.addDamage({ dst: this.id, damage });
  }
  move(ctx: BattleContext, direction: number, distance: number): void {
    this.position += direction * distance;
    ctx.events.addMove({ unit: this.id, direction, distance });
  }
  abstract onUpdateStatus(ctx: BattleContext): Status.Status;
  abstract onMove(ctx: BattleContext): void;
  abstract onUpdate(ctx: BattleContext): void;
  abstract onDeath(ctx: BattleContext): void;
}
