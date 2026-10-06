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

  constructor(player: PlayerState) {
    this.state = structuredClone(player);
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

  battleResult(result: Game.BattleResult): void {
    if (!this.activeBattle || this.activeBattle.uuid !== result.uuid) {
      throw new Error("Battle result does not match the active battle.");
    }
    this.activeBattle = undefined;
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

  forceChangeState(player: PlayerState): void {
    this.state = structuredClone(player);
  }
}
