import { RandomGenerator } from "../random-generator.js";
import { Loot } from "./loot.js";
import type { BattleSpec } from "../battle/battle.js";
import type { GameData } from "../game-data.js";
import type { Game } from "../game.js";
import type { PlayerState } from "./state.js";

export class PlayerManager {
  initPlayer(data: GameData): PlayerState {
    return structuredClone(data.playerDefinition.defaultState);
  }
  settleBattle(
    data: GameData,
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): PlayerState {
    const next = structuredClone(player);
    this.loot(data, battle, result, next);
    this.gainXP(data, battle, result, next);
    return next;
  }
  loot(
    data: GameData,
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): void {
    if (result.result !== "Victory") return;
    const items = Loot.generateLoots(data, new RandomGenerator(battle.seed), player);
    let slot = 0;
    for (const item of items) {
      while (slot < player.inventory.length && player.inventory[slot] !== null) {
        slot += 1;
      }
      player.inventory[slot] = item;
      slot += 1;
    }
  }
  gainXP(
    data: GameData,
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): void {
    if (result.result !== "Victory") return;
    const map = data.mapDefinitions[battle.map];
    if (!map) throw new Error(`Unknown map: ${battle.map}`);
    player.xp += map.xp;
    const thresholds = data.playerDefinition.levelXP;
    // Index 0 is the total XP required for level 1.
    while (player.level < thresholds.length) {
      const threshold = thresholds[player.level]!;
      if (player.xp < threshold) break;
      player.level += 1;
    }
  }
}
