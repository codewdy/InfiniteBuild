import type { BattleSpec, GameData, PlayerBuild } from "@infinite-build/core";

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
    event: { maxEventPerUnit: { damage: 10, effect: 10 } },
  },
  skillDefinitions: {
    fireball: {
      name: "火球",
      *caster(self, ctx) {
        let target: typeof self | undefined;
        let nearestDistance = Infinity;
        for (const unit of ctx.units) {
          if (unit.faction === self.faction || unit.hp <= 0) continue;
          const distance = Math.abs(unit.position - self.position);
          if (distance <= ctx.build.move.range && distance < nearestDistance) {
            target = unit;
            nearestDistance = distance;
          }
        }
        if (!target) return;
        const projectileSpeed = 1; // Distance units per frame.
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
        if (!target.isDead && target.hp > 0) target.damage(ctx, 10);
      },
    },
    nova: {
      name: "新星",
      *caster(self, ctx) {
        const radius = ctx.gameData.config.map.visionRange;
        const center = self.position;
        const durationFrames = 10;
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
          const waveRadius = radius * frame / durationFrames;
          for (const unit of ctx.units) {
            if (unit.faction === self.faction || unit.isDead || unit.hp <= 0
              || hitUnits.has(unit.id)
              || Math.abs(unit.position - center) > waveRadius) continue;
            hitUnits.add(unit.id);
            unit.damage(ctx, 6);
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
    { uuid: "mock-player-fireball", skill: "fireball", castRate: 0.5 },
    { uuid: "mock-player-nova", skill: "nova", castRate: 0.2 },
  ],
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
