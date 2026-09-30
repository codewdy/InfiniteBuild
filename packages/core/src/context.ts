import type { PlayerState } from "./player-state.js";
import type { GameData } from "./game-data.js";

export type Context = {
  playerState: PlayerState;
  gameData: GameData;
};
