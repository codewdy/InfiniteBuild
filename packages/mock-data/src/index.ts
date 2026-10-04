import { CombatResolver } from "@infinite-build/core";
import type {
  BattleSpec,
  GameData,
  PlayerBuild,
  SkillParams,
} from "@infinite-build/core";

function numberParam(
  params: SkillParams,
  key: string,
  positive = false,
): number {
  const value = params[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (positive ? value <= 0 : value < 0)
  ) {
    throw new Error(`Invalid skill parameter: ${key}`);
  }
  return value;
}

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
    event: { maxEventPerUnit: { damage: 10, effect: 10 } },
  },
  skillDefinitions: {
    selfDestruct: {
      name: "自爆",
      *caster(self, ctx, params) {
        const radius = numberParam(params, "radius");
        const damage = numberParam(params, "damage");
        for (const unit of ctx.units) {
          if (
            unit.faction === self.faction ||
            unit.isDead ||
            unit.hp <= 0 ||
            Math.abs(unit.position - self.position) > radius
          )
            continue;
          CombatResolver.hit(ctx, self, unit, damage);
        }
      },
    },
    fireball: {
      name: "火球",
      *caster(self, ctx, params) {
        const damage = numberParam(params, "damage");
        const range = numberParam(params, "range");
        const projectileSpeed = numberParam(params, "projectileSpeed", true);
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
        if (!target.isDead && target.hp > 0)
          CombatResolver.hit(ctx, self, target, damage);
      },
    },
    nova: {
      name: "新星",
      *caster(self, ctx, params) {
        const radius = numberParam(params, "radius");
        const damage = numberParam(params, "damage");
        const center = self.position;
        const durationFrames = numberParam(params, "durationFrames", true);
        if (!Number.isSafeInteger(durationFrames)) {
          throw new Error("durationFrames must be a positive safe integer");
        }
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
            CombatResolver.hit(ctx, self, unit, damage);
          }
        }
      },
    },
  },
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      status: { maxHp: 20, attack: 5, defense: 0 },
      move: { speed: 0.5, range: { min: 1.5, max: 2 } },
      skills: [],
      onDeath(self, ctx) {
        CombatResolver.cast(ctx, self, "selfDestruct", {
          damage: 1,
          radius: 2,
        });
      },
    },
    Goblin: {
      kind: "Goblin",
      status: { maxHp: 30, attack: 5, defense: 0 },
      move: { speed: 1, range: { min: 2.5, max: 3 } },
      skills: [],
    },
  },
  mapDefinitions: {
    demo: {
      totalValue: 60,
      spawner: [
        {
          mapSize: 5,
          value: 1,
          weight: 2,
          enemies: [{ kind: "Slime", count: { min: 1, max: 3 } }],
        },
        {
          mapSize: 7,
          value: 2,
          weight: 1,
          enemies: [{ kind: "Goblin", count: { min: 2, max: 3 } }],
        },
      ],
    },
  },
};

export const playerBuild: PlayerBuild = {
  level: 1,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
  skills: [
    {
      uuid: "mock-player-fireball",
      skill: "fireball",
      castRate: 0.5,
      params: { damage: 10, range: 5, projectileSpeed: 1 },
    },
    {
      uuid: "mock-player-nova",
      skill: "nova",
      castRate: 0.2,
      params: { damage: 6, radius: 20, durationFrames: 10 },
    },
  ],
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
