import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../../core/dist/index.js';
import { gameData } from '../../mock-data/dist/index.js';
import { GameUI } from '../../ui/dist/index.js';
import { GameApp } from '../dist/index.js';

async function setup(t, data = gameData) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const game = new Game(data, 42);
  // A plain adapter proves GameApp depends on the contract, not Game internals.
  const adapter = {
    get player() { return game.player; },
    get battle() { return game.battle; },
    ...Object.fromEntries(['getState', 'startLevel', 'startBattle', 'battleResult', 'changeState',
      'forceChangeState', 'completeTutorial', 'deleteItem', 'openLoots'].map(name => [name, game[name].bind(game)])),
  };
  const view = {
    updates: [], results: [], resets: [], destroyed: 0,
    update(state) { this.updates.push(state); },
    showStartScreen(start) { this.start = start; },
    resetBattle(options) { this.resets.push(options); },
    showBattleResult(result) { this.results.push(result); },
    destroy() { this.destroyed++; },
  };
  let actions;
  t.mock.method(GameUI, 'create', async (_canvas, options) => { actions = options; return view; });
  const app = await GameApp.create({ canvas: {}, game: adapter, gameData: data });
  t.after(() => app.destroy());
  return { app, game, adapter, view, actions, latest: () => view.updates.at(-1) };
}

function equip({ game, actions }) {
  const stone = game.player.inventory.find(Boolean);
  assert.equal(actions.onMoveTablet(stone.uuid, { area: 'tablets', index: 0 }), null);
}

test('UI alone starts onboarding, equips the stone and starts battle', async t => {
  const context = await setup(t);
  const { game, view, latest } = context;
  assert.equal(typeof view.start, 'function');
  t.mock.timers.tick(1000);
  assert.equal(latest().battle.log.frame, 0);
  view.start();
  t.mock.timers.tick(1000);
  assert.equal(latest().battle.log.frame, 0);
  equip(context);
  assert.deepEqual(game.player.tutorial.completed, ['equip-skill-tablet']);
  assert.equal(latest().battle.playing, true);
  t.mock.timers.tick(200);
  assert.equal(latest().battle.log.frame, 1);
});

test('playback UI owns the timer and destroy stops future updates', async t => {
  const context = await setup(t);
  const { app, view, actions, latest } = context;
  view.start(); equip(context); view.start();
  t.mock.timers.tick(200);
  assert.equal(latest().battle.log.frame, 1);
  actions.onTogglePlaying(); t.mock.timers.tick(1000);
  assert.equal(latest().battle.log.frame, 1);
  assert.equal(latest().battle.playing, false);
  actions.onTogglePlaying(); t.mock.timers.tick(200);
  assert.equal(latest().battle.log.frame, 2);
  app.destroy(); app.destroy();
  const updates = view.updates.length;
  actions.onTogglePlaying(); view.start(); t.mock.timers.tick(1000);
  assert.equal(view.updates.length, updates);
  assert.equal(view.destroyed, 1);
});

test('rejected equipment and invalid slots cannot complete the tutorial', async t => {
  const context = await setup(t);
  const { game, adapter, actions, view, latest } = context;
  view.start();
  const uuid = game.player.inventory[0].uuid;
  assert.ok(actions.onMoveTablet(uuid, { area: 'tablets', index: -1 }));
  assert.ok(actions.onMoveTablet(uuid, { area: 'tablets', index: 25 }));
  adapter.changeState = () => ({ kind: 'rejected', message: 'Rejected by injected game.' });
  assert.ok(actions.onMoveTablet(uuid, { area: 'tablets', index: 0 }));
  assert.deepEqual(game.player.tutorial.completed, []);
  assert.ok(game.player.inventory[0]);
  assert.equal(latest().battle.playing, false);
});

test('UI level selection keeps rejected battles intact and transitions valid levels', async t => {
  const context = await setup(t);
  const { game, actions, view, latest } = context;
  view.start(); equip(context);
  const before = game.battle.uuid;
  assert.throws(() => actions.onSelectLevel([1, 2]), /locked/);
  assert.equal(game.battle.uuid, before);
  assert.equal(view.resets.length, 0);
  actions.onSelectLevel([1, 1]);
  assert.notEqual(game.battle.uuid, before);
  assert.equal(view.resets.at(-1).transition, true);
  assert.equal(latest().battle.playing, true);
});

test('automatic completion settles once and presents the next battle', async t => {
  const data = { ...gameData, mapDefinitions: Object.fromEntries(Object.entries(gameData.mapDefinitions)
    .map(([key, map]) => [key, { ...map, totalValue: 0 }])) };
  const context = await setup(t, data);
  const { game, view, latest } = context;
  view.start(); equip(context);
  const uuid = game.battle.uuid;
  for (let i = 0; i < 100 && view.results.length === 0; i++) t.mock.timers.tick(200);
  assert.equal(view.results.length, 1);
  assert.equal(view.results[0].outcome, 'Victory');
  assert.ok(game.player.xp > 0);
  assert.notEqual(game.battle.uuid, uuid);
  assert.equal(latest().battle.playing, true);
});
