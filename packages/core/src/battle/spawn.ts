import type { Unit } from "./combat/unit.js";
import type { RandomGenerator } from "../random-generator.js";
import { RegularUnit } from "./combat/regular-unit.js";
import type { GameData } from "../game-data.js";

export type MapLevelDefinition = {
  level: [number, number];
  name: string;
  maps: string[];
};

export type MapDefinition = {
  name: string;
  background: string;
  totalValue: number;
  spawner: {
    mapSize: number;
    value: number;
    weight: number;
    enemies: {
      kind: string;
      count: {
        min: number;
        max: number;
      };
    }[];
  }[];
  xp: number;
};

export function spawn(
  gameData: GameData,
  map: string,
  rng: RandomGenerator,
): Unit[] {
  const definition = gameData.mapDefinitions[map]!;
  let position = gameData.config.map.spawnMinimumSize;
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
      const unitDefinition = gameData.unitDefinitions[enemy.kind]!;
      for (let i = 0; i < count; i++) {
        units.push(
          new RegularUnit(
            unitDefinition,
            rng.truncatedNorm(position, end),
            "Enemy",
            rng,
          ),
        );
      }
    }
    position = end;
    value += selected.value;
  }
  return units;
}
