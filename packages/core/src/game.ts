import type { GameData } from "./game-data.js";
import { RandomGenerator } from "./random-generator.js";
import { PlayerManager } from "./player/manager.js";
import type { BattleSettlement } from "./player/manager.js";
import type { BattleSpec } from "./battle/battle.js";
import type { PlayerState } from "./player/state.js";
import { stateValidate } from "./player/state-validate.js";
import type { ValidateError } from "./player/state-validate.js";

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

  constructor(data: GameData, seed: number = Date.now()) {
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

  startBattle(spec: BattleSpec): Game.Battle {
    if (this.activeBattle) {
      throw new Error("A battle is already active.");
    }
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

  forceChangeState(player: PlayerState): void {
    this.state = structuredClone(player);
  }
}
