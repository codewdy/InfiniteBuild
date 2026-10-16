import { setupCanvasPreview } from "./canvas-preview.js";
import { GameApp } from "@infinite-build/app";
import { Game } from "@infinite-build/core";
import { gameData } from "@infinite-build/mock-data";
import { initialPlayerStates } from "./player-states.js";

const canvas = document.querySelector<HTMLCanvasElement>("#battlefield");
if (!canvas) throw new Error("Missing game canvas.");

setupCanvasPreview(canvas);

const modeToggle = document.querySelector<HTMLButtonElement>("#mode-toggle");
if (!modeToggle) throw new Error("Missing mode toggle.");
const url = new URL(window.location.href);
const mode =
  url.searchParams.get("mode") === "production" ? "production" : "test";
modeToggle.textContent =
  mode === "test" ? "当前：测试版 · 切换正式版" : "当前：正式版 · 切换测试版";
modeToggle.addEventListener("click", () => {
  modeToggle.disabled = true;
  url.searchParams.set("mode", mode === "test" ? "production" : "test");
  window.location.assign(url.href);
});
const selectedGameData = {
  ...gameData,
  playerDefinition: {
    ...gameData.playerDefinition,
    defaultState: structuredClone(initialPlayerStates[mode]),
  },
};

const app = await GameApp.create({
  canvas,
  gameData: selectedGameData,
  game: new Game(selectedGameData),
});
window.addEventListener("pagehide", () => app.destroy(), { once: true });
