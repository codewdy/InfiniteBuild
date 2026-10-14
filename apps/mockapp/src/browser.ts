import { setupCanvasPreview } from "./canvas-preview.js";
import { GameApp } from "@infinite-build/app";
import { Game } from "@infinite-build/core";
import { gameData } from "@infinite-build/mock-data";

const canvas = document.querySelector<HTMLCanvasElement>("#battlefield");
if (!canvas) throw new Error("Missing game canvas.");

setupCanvasPreview(canvas);

const app = await GameApp.create({ canvas, gameData, game: new Game(gameData) });
window.addEventListener("pagehide", () => app.destroy(), { once: true });
