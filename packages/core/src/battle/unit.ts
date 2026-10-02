import type { BattleContext, Faction } from "./battle.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  hp!: number;
  damage(ctx: BattleContext, damage: number): void {
    this.hp -= damage;
    ctx.events.addDamage({ dst: this.id, damage });
  }
  move(ctx: BattleContext, direction: number, distance: number): void {
    this.position += direction * distance;
    ctx.events.addMove({ unit: this.id, direction, distance });
  }
  abstract onMove(ctx: BattleContext): void;
  abstract onUpdate(ctx: BattleContext): void;
}
