import { Battle } from "@infinite-build/core";
import { battleSpec, gameData, playerState } from "@infinite-build/mock-data";

const battle = new Battle(gameData, battleSpec, playerState);
const maxFrames = 100;

console.log(JSON.stringify(battle.renderLog()));
for (let frame = 0; frame < maxFrames; frame++) {
  const log = battle.executeFrame();
  console.log(JSON.stringify(log));
  if (log.status !== "Running") break;
}
