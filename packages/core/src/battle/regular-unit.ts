import { Unit } from "./unit.js";
import { CombatResolver } from "./combat/combat-resolver.js";
import type { UnitDefinition } from "../game-data.js";
import type { BattleContext, Faction } from "./battle.js";
import { Status } from "./status.js";
import type { RandomGenerator } from "./random-generator.js";
export class RegularUnit extends Unit {
  private definition: UnitDefinition;
  private skillProgress: number[];
  private moveRange: number;
  constructor(
    definition: UnitDefinition,
    position: number,
    faction: Faction,
    rng: RandomGenerator,
  ) {
    super();
    this.kind = definition.kind;
    this.position = position;
    this.faction = faction;
    this.definition = definition;
    this.skillProgress = definition.skills.map(() => rng.rand());
    const { min, max } = definition.move.range;
    this.moveRange = rng.uniform(min, max);
  }
  override calcBaseStatus(ctx: BattleContext): Status.Status {
    return Status.createByConfig(this.definition.status);
  }
  override onMove(ctx: BattleContext): void {
    const direction = this.faction === "Ally" ? 1 : -1;
    let nearestDistance = Infinity;
    for (const unit of ctx.units) {
      if (unit.faction === this.faction) continue;
      const distance = (unit.position - this.position) * direction;
      if (distance >= 0 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (nearestDistance === Infinity) return;

    const distanceToMove = Math.min(
      this.definition.move.speed,
      Math.max(0, nearestDistance - this.moveRange),
    );
    CombatResolver.move(ctx, this, direction, distanceToMove);
  }
  override onUpdate(ctx: BattleContext): void {
    for (let index = 0; index < this.definition.skills.length; index++) {
      const { skill, castRate, params } = this.definition.skills[index]!;
      this.skillProgress[index] = (this.skillProgress[index] ?? 0) + castRate;
      while (this.skillProgress[index]! >= 1) {
        this.skillProgress[index]! -= 1;
        CombatResolver.cast(ctx, this, skill, params);
      }
    }
    if (this.definition.onUpdate) {
      this.definition.onUpdate(this, ctx);
    }
  }

  override onDeath(ctx: BattleContext): void {
    if (this.definition.onDeath) {
      this.definition.onDeath(this, ctx);
    }
  }

  override onHitDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.definition.onHitDealt?.(this, ctx, dst, amount);
  }
  override onHitReceived(ctx: BattleContext, src: Unit, amount: number): void {
    this.definition.onHitReceived?.(this, ctx, src, amount);
  }
  override onDamageDealt(ctx: BattleContext, dst: Unit, amount: number): void {
    this.definition.onDamageDealt?.(this, ctx, dst, amount);
  }
  override onDamageReceived(
    ctx: BattleContext,
    src: Unit | null,
    amount: number,
  ): void {
    this.definition.onDamageReceived?.(this, ctx, src, amount);
  }
  override onHeal(ctx: BattleContext, src: Unit | null, amount: number): void {
    this.definition.onHeal?.(this, ctx, src, amount);
  }
  override onKill(ctx: BattleContext, dst: Unit): void {
    this.definition.onKill?.(this, ctx, dst);
  }
}
