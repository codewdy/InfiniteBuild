import type { GameData } from "./game-data.js";
import { RandomGenerator } from "./random-generator.js";
import { PlayerManager } from "./player/manager.js";
import type { BattleSettlement } from "./player/manager.js";
import type { BattleSpec } from "./battle/battle.js";
import type { MapLevel } from "./battle/spawn.js";
import type { PlayerState } from "./player/state.js";
import { stateValidate } from "./player/state-validate.js";
import type { ValidateError } from "./player/state-validate.js";
import type { Loot } from "./player/loot.js";
import type { Item } from "./player/item/item.js";

function compareMapLevels(left: MapLevel, right: MapLevel): number {
  return left[0] - right[0] || left[1] - right[1];
}

export namespace Game {
  export type Battle = {
    uuid: string;
    spec: BattleSpec;
    player: PlayerState;
  };
  export type BattleResult = {
    uuid: string;
    result: "Victory" | "Defeat";
    frame: number;
  };
}

export class Game {
  private activeBattle?: Game.Battle;
  private state: PlayerState;

  readonly rng: RandomGenerator;
  private readonly playerManager: PlayerManager;

  constructor(
    private readonly data: GameData,
    seed: number = Date.now(),
  ) {
    this.rng = new RandomGenerator(seed);
    this.playerManager = new PlayerManager(data, this.rng);
    this.state = this.playerManager.initPlayer();
  }

  get battle(): Game.Battle | undefined {
    return this.activeBattle ? structuredClone(this.activeBattle) : undefined;
  }

  get player(): PlayerState {
    return this.getState();
  }

  startLevel(level: MapLevel = this.state.currentMapLevel): Game.Battle {
    const definition = this.data.mapLevelDefinitions.find(
      (entry) => entry.level[0] === level[0] && entry.level[1] === level[1],
    );
    if (!definition) throw new Error(`Unknown level: ${level.join("-")}`);
    if (compareMapLevels(level, this.state.highestUnlockedMapLevel) > 0) {
      throw new Error(`Level is locked: ${level.join("-")}`);
    }
    if (!definition.maps.length)
      throw new Error(`Level has no maps: ${level.join("-")}`);
    for (const map of definition.maps) {
      if (!this.data.mapDefinitions[map])
        throw new Error(`Unknown map: ${map}`);
    }
    const map = this.rng.choice(definition.maps)!;
    return this.startBattle({
      level,
      map,
      seed: this.rng.randInt(0, 0xffffffff),
    });
  }

  startBattle(spec: BattleSpec): Game.Battle {
    this.state.currentMapLevel = [...spec.level];
    this.activeBattle = {
      uuid: crypto.randomUUID(),
      spec: structuredClone(spec),
      player: this.getState(),
    };
    return structuredClone(this.activeBattle);
  }

  battleResult(result: Game.BattleResult): BattleSettlement {
    if (!this.activeBattle || this.activeBattle.uuid !== result.uuid) {
      throw new Error("Battle result does not match the active battle.");
    }
    const settlement = this.playerManager.settleBattle(
      this.activeBattle.spec,
      result,
      this.state,
    );
    if (result.result === "Victory") {
      const completedLevel = this.activeBattle.spec.level;
      const nextLevel = this.data.mapLevelDefinitions
        .map((definition) => definition.level)
        .filter((level) => compareMapLevels(level, completedLevel) > 0)
        .sort(compareMapLevels)[0];
      if (
        nextLevel &&
        compareMapLevels(nextLevel, settlement.player.highestUnlockedMapLevel) >
          0
      ) {
        settlement.player.highestUnlockedMapLevel = [...nextLevel];
      }
    }
    this.state = settlement.player;
    this.activeBattle = undefined;
    return structuredClone(settlement);
  }

  getState(): PlayerState {
    return structuredClone(this.state);
  }

  changeState(player: PlayerState): ValidateError | null {
    const error = stateValidate(this.state, player);
    if (error) return error;
    this.forceChangeState(player);
    return null;
  }

  deleteItem(uuid: string): void {
    this.playerManager.deleteItem(this.state, uuid);
  }
  openLoots(
    loot: Loot.LootItem,
    count?: number,
  ): { player: PlayerState; items: Item[] } {
    const opened = this.playerManager.openLoots(this.state, loot, count);
    this.state = opened.player;
    return structuredClone(opened);
  }

  forceChangeState(player: PlayerState): void {
    this.state = structuredClone(player);
  }
}
