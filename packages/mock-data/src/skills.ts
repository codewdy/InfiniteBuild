import { z } from "zod";
import { GameData, hit } from "@infinite-build/core";
import { ignite } from "./buffs.js";

export const selfDestruct = GameData.defineSkill({
  id: "selfDestruct",
  params: z.object({
    damage: z.number().nonnegative(),
    radius: z.number().nonnegative(),
  }),
  name: "自爆",
  *caster(ctx, self, skill) {
    const { radius, damage } = skill.params;
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
  *caster(ctx, self, skill) {
    const { damage, range, projectileSpeed } = skill.params;
    let target: typeof self | undefined;
    let nearestDistance = Infinity;
    for (const unit of ctx.units) {
      if (unit.faction === self.faction || unit.hp <= 0) continue;
      const distance = Math.abs(unit.position - self.position);
      if (distance <= range && distance < nearestDistance) {
        target = unit;
        nearestDistance = distance;
      }
    }
    if (!target) return;
    const durationFrames = Math.max(
      1,
      Math.ceil(nearestDistance / projectileSpeed),
    );
    ctx.events.addEffect({
      effect: "fireball",
      source: self.id,
      skill: "fireball",
      payload: {
        from: self.position,
        to: target.id,
        durationFrames,
      },
    });
    yield* ctx.taskScheduler.waitFrames(durationFrames);
    if (!target.isDead) {
      hit(ctx, self, target, damage);
      target.applyBuff(ignite.id, damage * 0.01, 20);
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
  *caster(ctx, self, skill) {
    const { radius, damage, durationFrames } = skill.params;
    const center = self.position;
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
      yield* ctx.taskScheduler.waitFrames(1);
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

export const skillDefinitions = GameData.skills([selfDestruct, fireball, nova]);
