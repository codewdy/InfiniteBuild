import { Position } from "../position.js";
import { Unit } from "./unit.js";
import { move, moveBySkillRange } from "./movement.js";
import type { BattleContext } from "../battle.js";
import type { Status } from "./status.js";
import { derivePlayerCombatProfile } from "../../player/state.js";
import type { PlayerCombatProfile } from "../../player/state.js";

export class PlayerUnit extends Unit {
  combatProfile?: PlayerCombatProfile;
  constructor() {
    super();
    this.kind = "Player";
    this.name = "玩家";
    this.faction = "Ally";
    this.position = { x: 0, y: 0 };
  }
  onStateChanged(ctx: BattleContext): void {
    this.collisionRadius = ctx.gameData.playerDefinition.collisionRadius;
    this.combatProfile = derivePlayerCombatProfile(
      ctx.gameData,
      ctx.playerState,
    );
    this.skills = this.combatProfile.skills;
  }
  override calcBaseStatus(ctx: BattleContext): Status {
    return this.combatProfile!.status;
  }
  override onMove(ctx: BattleContext): void {
    if (this.isDead || (this.rawStatus.attributes.speed ?? 0) <= 0) {
      return;
    }
    const { minimumEnemyCount } = this.combatProfile!.config;
    let enemyCount = 0;
    for (const unit of ctx.units) {
      if (
        unit.faction !== this.faction &&
        !unit.isDead &&
        ctx.allSpawns.has(unit)
      ) {
        enemyCount += 1;
      }
    }
    if (enemyCount < minimumEnemyCount && ctx.pendingSpawns.length > 0) {
      const target = ctx.pendingSpawns.reduce((nearest, unit) =>
        Position.distance(this.position, unit.position) <
        Position.distance(this.position, nearest.position)
          ? unit
          : nearest,
      );
      move(ctx, this, { x: 1, y: 0 }, this.rawStatus.attributes.speed ?? 0);
      return;
    }
    moveBySkillRange(ctx, this);
  }
  override onUpdate(ctx: BattleContext): void {
    super.onUpdate(ctx);
    for (const { uuid, skill, castRate } of this.skills.onUpdate ?? []) {
      const progress =
        castRate === undefined
          ? 0
          : (this.skillTrigger.progress.get(uuid) ?? 0);
      ctx.events.addPlayerSkillProgress({
        uuid,
        skill,
        castRate: castRate ?? 1,
        progress,
      });
    }
  }
}
