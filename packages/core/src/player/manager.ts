import type { RandomGenerator } from "../random-generator.js";
import { Loot } from "./loot.js";
import type { BattleSpec } from "../battle/battle.js";
import type { GameData } from "../game-data.js";
import type { Game } from "../game.js";
import type { PlayerState } from "./state.js";

export class PlayerManager {
  constructor(
    private readonly data: GameData,
    private readonly rng: RandomGenerator,
  ) {}

  initPlayer(): PlayerState {
    return structuredClone(this.data.playerDefinition.defaultState);
  }
  settleBattle(
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): PlayerState {
    const next = structuredClone(player);
    this.loot(result, next);
    this.gainXP(battle, result, next);
    return next;
  }
  loot(result: Game.BattleResult, player: PlayerState): void {
    if (result.result !== "Victory") return;
    const items = Loot.generateLoots(this.data, this.rng, player);
    let slot = 0;
    for (const item of items) {
      while (
        slot < player.inventory.length &&
        player.inventory[slot] !== null
      ) {
        slot += 1;
      }
      player.inventory[slot] = item;
      slot += 1;
    }
  }
  gainXP(
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): void {
    if (result.result !== "Victory") return;
    const map = this.data.mapDefinitions[battle.map];
    if (!map) throw new Error(`Unknown map: ${battle.map}`);
    player.xp += map.xp;
    const thresholds = this.data.playerDefinition.levelXP;
    // Index 0 is the total XP required for level 1.
    while (player.level < thresholds.length) {
      const threshold = thresholds[player.level]!;
      if (player.xp < threshold) break;
      player.level += 1;
    }
  }
  deleteItem(player: PlayerState, uuid: string): void {
    const stored = player.inventory.findIndex((item) => item?.uuid === uuid);
    if (stored >= 0) player.inventory[stored] = null;
    const equipped = player.tablets.findIndex(
      (tablet) => tablet?.uuid === uuid,
    );
    if (equipped >= 0) player.tablets[equipped] = null;
  }
}
