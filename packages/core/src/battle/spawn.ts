import type { Unit } from "./combat/unit.js";
import type { RandomGenerator } from "../random-generator.js";
import { RegularUnit } from "./combat/regular-unit.js";
import type { GameData } from "../game-data.js";

export type MapLevel = [number, number];

export type MapLevelDefinition = {
  level: MapLevel;
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

export type SpawnUnit = Unit & { groupId: number };

export function spawn(
  gameData: GameData,
  map: string,
  rng: RandomGenerator,
): SpawnUnit[] {
  const definition = gameData.mapDefinitions[map]!;
  const { right, top, bottom } = gameData.config.map.visionRange;
  let position = -1;
  const spawners = definition.spawner.filter((spawner) => spawner.weight > 0);
  const weights = spawners.map((spawner) => spawner.weight);

  const units: SpawnUnit[] = [];
  let groupId = 0;
  let value = 0;
  while (value < definition.totalValue) {
    const selected = spawners[rng.weightedIndex(weights)]!;
    if (groupId == 0) position = right - selected.mapSize;
    const end = position + selected.mapSize;
    for (const enemy of selected.enemies) {
      const count = rng.randInt(enemy.count.min, enemy.count.max);
      const unitDefinition = gameData.unitDefinitions[enemy.kind]!;
      for (let i = 0; i < count; i++) {
        units.push(
          Object.assign(
            new RegularUnit(
              unitDefinition,
              {
                x: rng.truncatedNorm(position, end),
                y: rng.truncatedNorm(-top, bottom),
              },
              "Enemy",
              rng,
            ),
            { groupId },
          ),
        );
      }
    }
    position = end;
    value += selected.value;
    groupId += 1;
  }
  return units;
}
