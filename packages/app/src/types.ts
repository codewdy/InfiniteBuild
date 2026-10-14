import type { GameData } from "@infinite-build/core";
import type { GameInterface } from "./game-interface.js";

/** The game implementation and definitions must describe the same game. */
export type GameAppOptions = {
  canvas: HTMLCanvasElement;
  game: GameInterface;
  gameData: GameData;
};
