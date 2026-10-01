import type { Context } from "../context.js";
import type { Unit } from "./unit.js";
import type { RandomGenerator } from "./random-generator.js";
import { RegularUnit } from "./regular-unit.js";

export function spawn(ctx: Context, map: string, rng: RandomGenerator): Unit[] {
  const definition = ctx.gameData.mapDefinitions[map]!;
  let position = ctx.gameData.config.map.spawnMinimumSize;
  const spawners = definition.spawner.filter((spawner) => spawner.weight > 0);
  const totalWeight = spawners.reduce(
    (sum, spawner) => sum + spawner.weight,
    0,
  );

  const units: Unit[] = [];
  let value = 0;
  while (value < definition.totalValue) {
    let roll = Math.max(0, Math.min(totalWeight, rng.uniform(0, totalWeight)));
    // If rounding leaves roll at the upper edge or a positive remainder,
    // fall back to the last positive-weight spawner.
    let selected = spawners[spawners.length - 1]!;
    for (const spawner of spawners) {
      if (roll < spawner.weight) {
        selected = spawner;
        break;
      }
      roll -= spawner.weight;
    }

    const end = position + selected.mapSize;
    for (const enemy of selected.enemies) {
      const count = rng.randInt(enemy.count.min, enemy.count.max);
      const unitDefinition = ctx.gameData.unitDefinitions[enemy.kind]!;
      for (let i = 0; i < count; i++) {
        units.push(
          new RegularUnit(
            unitDefinition,
            rng.truncatedNorm(position, end),
            "Enemy",
          ),
        );
      }
    }
    position = end;
    value += selected.value;
  }
  return units;
}
