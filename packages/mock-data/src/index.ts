import type { BattleSpec, GameData, PlayerState } from "@infinite-build/core";

export const gameData: GameData = {
  config: {
    map: { spawnMinimumSize: 5, visionRange: 20 },
    event: { maxEventPerUnit: { damage: 10 } },
  },
  skillDefinitions: {
    SelfDamage: {
      name: "自伤",
      *caster(self, ctx) {
        const attack = self.rawStatus.attack;
        self.damage(ctx, attack * 0.4);
        yield* ctx.taskScheduler.waitFrames(1);
        self.damage(ctx, attack * 0.6);
      },
    },
  },
  unitDefinitions: {
    Slime: {
      kind: "Slime",
      status: { maxHp: 20, attack: 5, defense: 0 },
      move: { speed: 0.5, range: 2 },
      onUpdate(self, ctx) {
        if (
          Math.abs(self.position - ctx.player.position) <=
            ctx.ctx.playerState.move.range &&
          ctx.rng.rand() < 0.3
        ) {
          self.cast(ctx, "SelfDamage");
        }
      },
    },
    Goblin: {
      kind: "Goblin",
      status: { maxHp: 30, attack: 5, defense: 0 },
      move: { speed: 1, range: 3 },
      onUpdate(self, ctx) {
        if (
          Math.abs(self.position - ctx.player.position) <=
            ctx.ctx.playerState.move.range &&
          ctx.rng.rand() < 0.3
        ) {
          self.damage(ctx, self.rawStatus.attack);
        }
      },
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

export const playerState: PlayerState = {
  level: 1,
  move: { speed: 1, safeRange: 1, range: 5, count: 2 },
};

export const battleSpec: BattleSpec = { seed: 42, map: "demo" };
