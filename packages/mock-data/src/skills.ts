import { z } from "zod";
import { GameData, hit, Skill, TaskScheduler } from "@infinite-build/core";
import { ignite } from "./buffs.js";

export const attack = GameData.defineSkill({
  id: "attack",
  params: z.object({ range: z.number().nonnegative() }),
  name: "攻击",
  targetingRange: (_ctx, _self, skill) => skill.params.range,
  description: ({ range }) =>
    `攻击射程 ${range} 内最近的敌人，造成攻击力 10% 的伤害。`,
  *cast(ctx, self, skill) {
    let target: typeof self | undefined;
    let nearestDistance = Infinity;
    for (const unit of ctx.units) {
      if (unit.faction === self.faction || unit.isDead || unit.hp <= 0)
        continue;
      const distance = Math.abs(unit.position - self.position);
      if (distance <= skill.params.range && distance < nearestDistance) {
        target = unit;
        nearestDistance = distance;
      }
    }
    if (!target) return;
    yield* Skill.ready();
    ctx.events.addEffect({
      effect: "attack",
      source: self.id,
      skill: "attack",
      payload: { from: self.position, to: target.id, durationFrames: 3 },
    });
    hit(ctx, self, target, (self.rawStatus.attributes.attack ?? 0) * 0.1);
  },
});

export const selfDestruct = GameData.defineSkill({
  id: "selfDestruct",
  params: z.object({
    damage: z.number().nonnegative(),
    radius: z.number().nonnegative(),
  }),
  name: "自爆",
  description: ({ damage, radius }) =>
    `自爆，对半径 ${radius} 内的敌人造成 ${damage} 点伤害。`,
  *cast(ctx, self, skill) {
    const { radius, damage } = skill.params;
    yield* Skill.ready();
    for (const unit of ctx.units) {
      if (
        unit.faction === self.faction ||
        unit.isDead ||
        unit.hp <= 0 ||
        Math.abs(unit.position - self.position) > radius
      )
        continue;
      hit(ctx, self, unit, damage);
    }
  },
});

export const fireball = GameData.defineSkill({
  id: "fireball",
  params: z.object({
    damage: z.number().nonnegative(),
    range: z.number().nonnegative(),
    projectileSpeed: z.number().positive(),
  }),
  name: "火球",
  targetingRange: (_ctx, _self, skill) => skill.params.range,
  description: ({ damage, range, projectileSpeed }) =>
    `向射程 ${range} 内最近的敌人发射火球，每帧飞行 ${projectileSpeed} 个距离单位，命中造成 ${damage} 点伤害并施加点燃。`,
  *cast(ctx, self, skill) {
    const { damage, range, projectileSpeed } = skill.params;
    let target: typeof self | undefined;
    let nearestDistance = Infinity;
    for (const unit of ctx.units) {
      if (unit.faction === self.faction || unit.isDead) continue;
      const distance = Math.abs(unit.position - self.position);
      if (distance <= range && distance < nearestDistance) {
        target = unit;
        nearestDistance = distance;
      }
    }
    if (!target) return;
    yield* Skill.ready();
    ctx.events.addEffect({
      effect: "fireball",
      source: self.id,
      skill: "fireball",
      payload: {
        from: self.position,
        to: target.id,
        projectileSpeed,
      },
    });
    let projectilePosition = self.position;
    let previousTargetPosition = target.position;
    while (true) {
      yield* Skill.waitFrames(1);
      if (target.isDead) return;
      const distance = target.position - projectilePosition;
      // Movement runs after scheduled tasks. A target may have crossed the
      // projectile since the previous tick, even if it is now far away.
      const crossedProjectile =
        Math.sign(previousTargetPosition - projectilePosition) !==
        Math.sign(distance);
      if (crossedProjectile || Math.abs(distance) <= projectileSpeed) {
        hit(ctx, self, target, damage);
        target.applyBuff(ignite.id, damage * 0.01, 20);
        return;
      }
      projectilePosition += Math.sign(distance) * projectileSpeed;
      previousTargetPosition = target.position;
    }
  },
});

export const nova = GameData.defineSkill({
  id: "nova",
  params: z.object({
    damage: z.number().nonnegative(),
    radius: z.number().nonnegative(),
    durationFrames: z.number().int().positive(),
  }),
  name: "新星",
  description: ({ damage, radius, durationFrames }) =>
    `释放新星，在 ${durationFrames} 帧内扩散至半径 ${radius}，对每个敌人造成 ${damage} 点伤害。`,
  *cast(ctx, self, skill) {
    const { radius, damage, durationFrames } = skill.params;
    const center = self.position;
    yield* Skill.ready();
    ctx.events.addEffect({
      effect: "nova",
      source: self.id,
      skill: "nova",
      payload: {
        center,
        radius,
        durationFrames,
      },
    });
    const hitUnits = new Set<number>();
    for (let frame = 1; frame <= durationFrames; frame++) {
      yield* Skill.waitFrames(1);
      const waveRadius = (radius * frame) / durationFrames;
      for (const unit of ctx.units) {
        if (
          unit.faction === self.faction ||
          unit.isDead ||
          unit.hp <= 0 ||
          hitUnits.has(unit.id) ||
          Math.abs(unit.position - center) > waveRadius
        )
          continue;
        hitUnits.add(unit.id);
        hit(ctx, self, unit, damage);
      }
    }
  },
});

export const skillDefinitions = GameData.skills([
  attack,
  selfDestruct,
  fireball,
  nova,
]);
