import { Battle, Game } from "@infinite-build/core";
import { battleSpec, gameData } from "@infinite-build/mock-data";

const game = new Game(gameData);
const battleCount = 3;
const maxFrames = 10000;

for (let round = 0; round < battleCount; round++) {
  const task = game.startBattle({
    ...battleSpec,
    seed: battleSpec.seed + round,
  });
  const battle = new Battle(gameData, task.spec, task.player);
  let log = battle.renderLog();
  console.log(
    JSON.stringify({ kind: "BattleStarted", round: round + 1, ...task }),
  );
  console.log(JSON.stringify(log));
  while (log.status === "Running" && log.frame < maxFrames) {
    log = battle.executeFrame();
    console.log(JSON.stringify(log));
  }
  if (log.status === "Running") {
    throw new Error(`Battle ${task.uuid} exceeded ${maxFrames} frames.`);
  }
  const result: Game.BattleResult = {
    uuid: task.uuid,
    result: log.status,
    frame: log.frame,
  };
  game.battleResult(result);
  console.log(JSON.stringify({ kind: "BattleFinished", ...result }));
}
