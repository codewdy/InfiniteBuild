import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";

export abstract class Unit {
  id: number = -1;
  kind!: string;
  faction!: Faction;
  position!: number;
  maxHp: number = 1;
  hp: number = 1;
  isDead: boolean = false;
  rawStatus: Status.RawStatus = Status.resolve(
    Status.createByConfig({ maxHp: 1 }),
  );
  status: Status.Status = Status.createByConfig({ maxHp: 1 });

  updateStatus(ctx: BattleContext): void {
    let status = this.onUpdateStatus(ctx);
    this.status = status;
    this.rawStatus = Status.resolve(this.status);
    if (this.status.maxHp != this.maxHp) {
      this.hp = (this.hp * this.rawStatus.maxHp) / this.maxHp;
      this.maxHp = this.rawStatus.maxHp;
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
  cast(ctx: BattleContext, skill: string): void {
    const definition = ctx.gameData.skillDefinitions[skill];
    if (!definition) throw new Error(`Unknown skill: ${skill}`);
    ctx.taskScheduler.start(() => definition.caster(this, ctx));
  }
  abstract onUpdateStatus(ctx: BattleContext): Status.Status;
  abstract onMove(ctx: BattleContext): void;
  onUpdate(ctx: BattleContext): void {}
  abstract onDeath(ctx: BattleContext): void;
}
