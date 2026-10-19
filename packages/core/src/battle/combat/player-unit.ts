import { Unit } from "./unit.js";
import { move, moveBySkillRange } from "./movement.js";
import type { BattleContext } from "../battle.js";
import type { Status } from "./status.js";
import { derivePlayerCombatProfile } from "../../player/state.js";
import type { PlayerCombatProfile } from "../../player/state.js";

export class PlayerUnit extends Unit {
  combatProfile?: PlayerCombatProfile;
  private advancingGroupId: number | undefined;
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
    const pendingEnemies = ctx.pendingSpawns.filter(
      (unit) => unit.faction !== this.faction && !unit.isDead,
    );
    if (
      this.advancingGroupId !== undefined &&
      !pendingEnemies.some((unit) => unit.groupId === this.advancingGroupId)
    ) {
      this.advancingGroupId = undefined;
    }

    if (this.advancingGroupId === undefined) {
      const hasEnemies = [...ctx.units].some(
        (unit) => unit.faction !== this.faction && !unit.isDead,
      );
      if (!hasEnemies && pendingEnemies.length > 0) {
        this.advancingGroupId = pendingEnemies.reduce(
          (groupId, unit) => Math.min(groupId, unit.groupId),
          pendingEnemies[0]!.groupId,
        );
      }
    }

    if (this.advancingGroupId !== undefined) {
      const group = pendingEnemies.filter(
        (unit) => unit.groupId === this.advancingGroupId,
      );
      const distance = group.reduce(
        (remaining, unit) =>
          Math.max(
            remaining,
            unit.position.x -
              this.position.x -
              ctx.gameData.config.map.visionRange.right,
          ),
        0,
      );
      move(
        ctx,
        this,
        { x: 1, y: 0 },
        Math.min(this.rawStatus.attributes.speed ?? 0, distance),
      );
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
