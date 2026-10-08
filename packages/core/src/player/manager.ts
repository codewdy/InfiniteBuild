import type { RandomGenerator } from "../random-generator.js";
import { Loot } from "./loot.js";
import type { BattleSpec } from "../battle/battle.js";
import type { GameData } from "../game-data.js";
import type { Game } from "../game.js";
import type { PlayerState } from "./state.js";
import type { Item } from "./item/item.js";

export type BattleSettlement = {
  player: PlayerState;
  items: Item[];
  pendingLoot: Loot.LootItem[];
  xpGain: number;
};

export class PlayerManager {
  constructor(
    private readonly data: GameData,
    private readonly rng: RandomGenerator,
  ) {}

  initPlayer(): PlayerState {
    const player = structuredClone(this.data.playerDefinition.defaultState);
    while (
      player.inventory.length < this.data.playerDefinition.inventoryCapacity
    ) {
      player.inventory.push(null);
    }
    return player;
  }
  settleBattle(
    battle: BattleSpec,
    result: Game.BattleResult,
    player: PlayerState,
  ): BattleSettlement {
    const next = structuredClone(player);
    const { items, pendingLoot } = this.loot(result, next);
    this.gainXP(battle, result, next);
    return { player: next, items, pendingLoot, xpGain: next.xp - player.xp };
  }
  loot(
    result: Game.BattleResult,
    player: PlayerState,
  ): Pick<BattleSettlement, "items" | "pendingLoot"> {
    const items: Item[] = [];
    const pendingLoot: Loot.LootItem[] = [];
    if (result.result !== "Victory") return { items, pendingLoot };
    const loots = Loot.generateLoots(this.data, this.rng, player);
    const capacity = this.data.playerDefinition.inventoryCapacity;
    let slot = 0;
    for (const loot of loots) {
      while (slot < capacity && player.inventory[slot] != null) {
        slot += 1;
      }
      if (slot >= capacity) {
        this.addPendingLoot(player.pendingLoot, loot);
        pendingLoot.push(loot);
        continue;
      }
      const item = Loot.generateLoot(this.data, this.rng, loot);
      player.inventory[slot] = item;
      items.push(item);
      slot += 1;
    }
    return { items, pendingLoot };
  }
  private addPendingLoot(
    pendingLoot: PlayerState["pendingLoot"],
    loot: Loot.LootItem,
  ): void {
    const stack = pendingLoot.find(
      (entry) =>
        entry.loot.kind === loot.kind &&
        entry.loot.rarity === loot.rarity &&
        entry.loot.level === loot.level,
    );
    if (stack) stack.count += 1;
    else pendingLoot.push({ loot: { ...loot }, count: 1 });
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
  openLoots(
    player: PlayerState,
    loot: Loot.LootItem,
    count?: number,
  ): { player: PlayerState; items: Item[] } {
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) {
      throw new RangeError("Loot count must be a non-negative safe integer.");
    }
    const next = structuredClone(player);
    const items: Item[] = [];
    const index = next.pendingLoot.findIndex(
      (entry) =>
        entry.loot.kind === loot.kind &&
        entry.loot.rarity === loot.rarity &&
        entry.loot.level === loot.level,
    );
    if (index < 0) return { player: next, items };
    const stack = next.pendingLoot[index]!;
    const limit = Math.min(count ?? stack.count, stack.count);
    const capacity = this.data.playerDefinition.inventoryCapacity;
    for (let slot = 0; slot < capacity && items.length < limit; slot += 1) {
      if (next.inventory[slot] != null) continue;
      const item = Loot.generateLoot(this.data, this.rng, stack.loot);
      next.inventory[slot] = item;
      items.push(item);
      stack.count -= 1;
    }
    if (stack.count === 0) next.pendingLoot.splice(index, 1);
    return { player: next, items };
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
