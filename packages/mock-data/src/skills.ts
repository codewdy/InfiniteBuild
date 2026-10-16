import { z } from "zod";
import {
  GameData,
  Position,
  hit,
  Projectile,
  Skill,
} from "@infinite-build/core";
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
      if (unit.faction === self.faction || unit.isDead) continue;
      const distance = Position.distance(unit.position, self.position);
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
        Position.distance(unit.position, self.position) > radius
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
    projectileSpeed: z.number().positive(),
    bounce: z.number().int().positive().default(1),
    range: z.number().nonnegative(),
  }),
  name: "火球",
  targetingRange: (_ctx, _self, skill) => skill.params.range,
  description: ({ damage, projectileSpeed, bounce, range }) =>
    `向射程 ${range} 内随机一个敌人发射火球，每帧飞行 ${projectileSpeed} 个距离单位，命中造成 ${damage} 点伤害并施加点燃，最多弹射 ${bounce - 1} 次。`,
  *cast(ctx, self, skill) {
    const { damage, projectileSpeed, bounce = 1, range } = skill.params;
    yield* Skill.ready();
    Projectile.fire({
      ctx,
      effect: "fireball",
      source: self,
      from: self,
      speed: projectileSpeed,
      range,
      bounce,
      onHit(unit) {
        hit(ctx, self, unit, damage);
        unit.applyBuff(ignite.id, damage * 0.01, 20);
      },
    });
  },
});

export const chainLightning = GameData.defineSkill({
  id: "chainLightning",
  params: z.object({
    damage: z.number().nonnegative(),
    range: z.number().nonnegative(),
  }),
  name: "闪电链",
  targetingRange: (_ctx, _self, skill) => skill.params.range,
  description: ({ damage, range }) =>
    `向射程 ${range} 内随机一个敌人释放闪电，额外弹射 3 次，在同一帧对最多 4 个不同敌人各造成 ${damage} 点伤害。`,
  *cast(ctx, self, skill) {
    const { damage, range } = skill.params;
    yield* Skill.ready();
    Projectile.fire({
      ctx,
      source: self,
      from: self,
      effect: "chainLightning",
      range,
      bounce: 4,
      onHit: (unit) => hit(ctx, self, unit, damage),
    });
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
          hitUnits.has(unit.id) ||
          Position.distance(unit.position, center) > waveRadius
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
  chainLightning,
  nova,
]);
