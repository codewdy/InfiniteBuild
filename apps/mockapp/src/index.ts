import { Battle } from "@infinite-build/core";
import { battleSpec, gameData, playerBuild } from "@infinite-build/mock-data";

const battle = new Battle(gameData, battleSpec, playerBuild);
const maxFrames = 100;

console.log(JSON.stringify(battle.renderLog()));
for (let frame = 0; frame < maxFrames; frame++) {
  const log = battle.executeFrame();
  console.log(JSON.stringify(log));
  if (log.status !== "Running") break;
}
