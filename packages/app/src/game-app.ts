import type { GameInterface } from "./game-interface.js";
import { Battle } from "@infinite-build/core";
import type {
  BattleLog,
  BattleSettlement,
  GameData,
  MapLevel,
  PlayerState,
} from "@infinite-build/core";
import {
  GameUI,
  completedTutorials,
  EQUIP_SKILL_TUTORIAL,
  SELECT_LEVEL_TUTORIAL,
  levelTutorialPending,
} from "@infinite-build/ui";
import type {
  BattlefieldResult,
  PendingLootItem,
  SlotLocation,
} from "@infinite-build/ui";
import type { GameAppOptions } from "./types.js";

/** Owns application flow; GameInterface owns player state and GameUI owns rendering. */
export class GameApp {
  private task: GameInterface.Battle;
  private battle: Battle;
  private log: BattleLog;
  private readonly frameDuration = 200;
  private timer?: ReturnType<typeof setInterval>;
  private started = false;
  private destroyed = false;
  private constructor(
    private readonly game: GameInterface,
    private readonly data: GameData,
    private readonly view: GameUI,
  ) {
    this.task = game.battle ?? game.startLevel();
    this.battle = new Battle(data, this.task.spec, game.getState());
    this.log = this.battle.renderLog();
    this.publish();
  }

  static async create({
    canvas,
    game,
    gameData,
  }: GameAppOptions): Promise<GameApp> {
    let app: GameApp;
    const ui = await GameUI.create(canvas, {
      gameData,
      onMoveTablet: (uuid, target) => app.moveTablet(uuid, target),
      onRotateTablet: (uuid) => app.rotateTablet(uuid),
      onClaimLoot: (loot, count) => app.claimLoot(loot, count),
      onSelectLevel: (level) => app.selectLevel(level),
      onAutoAdvanceLevelChange: (enabled) => {
        const player = app.player;
        player.config.autoAdvanceLevel = enabled;
        app.changeState(player);
      },
      onTogglePlaying: () => app.togglePlaying(),
    });
    try {
      app = new GameApp(game, gameData, ui);
      ui.showStartScreen(() => app.start());
      return app;
    } catch (error) {
      ui.destroy();
      throw error;
    }
  }

  private get player(): PlayerState {
    return this.game.getState();
  }

  private start(): void {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.resume();
  }

  private resume(): void {
    if (this.destroyed || !this.started) return;
    if (!this.tutorialPending && this.timer === undefined) {
      this.timer = setInterval(() => this.advance(), this.frameDuration);
    }
    this.publish();
  }

  private pause(): void {
    if (this.destroyed) return;
    this.stopTimer();
    this.publish();
  }

  private togglePlaying(): void {
    if (this.timer === undefined) this.resume();
    else this.pause();
  }

  private selectLevel(level: MapLevel): void {
    if (this.destroyed || !this.started) return;
    // Validate/start before resetting presentation, so a rejected level keeps the current battle intact.
    const pending = levelTutorialPending(this.player);
    const task = this.game.startLevel(level);
    const completed = pending && level[0] === 1 && level[1] === 2;
    if (completed) this.game.completeTutorial(SELECT_LEVEL_TUTORIAL);
    this.replaceBattle(task);
    if (completed) this.resume();
    else this.publish();
  }

  private changeState(state: PlayerState): GameInterface.ValidateError | null {
    if (this.destroyed)
      return { kind: "lifecycle", message: "GameApp is destroyed." };
    const previous = this.player;
    const error = this.game.changeState(state);
    if (error) return error;
    for (const tutorial of completedTutorials(previous, this.player))
      this.game.completeTutorial(tutorial);
    this.afterPlayerChange();
    if (
      this.started &&
      !previous.tutorial.completed.includes(EQUIP_SKILL_TUTORIAL) &&
      !this.tutorialPending
    )
      this.resume();
    return null;
  }

  private moveTablet(
    uuid: string,
    target: SlotLocation,
  ): GameInterface.ValidateError | null {
    const state = this.player;
    const slots = state[target.area];
    if (
      !slots ||
      !Number.isInteger(target.index) ||
      target.index < 0 ||
      target.index >= slots.length
    ) {
      return { kind: "slot", message: "Invalid target slot." };
    }
    const source = state.tablets.some((tablet) => tablet?.uuid === uuid)
      ? state.tablets
      : state.inventory;
    const index = source.findIndex((item) => item?.uuid === uuid);
    const tablet = source[index];
    if (!tablet || (source === slots && index === target.index)) return null;
    source[index] = slots[target.index] ?? null;
    slots[target.index] = tablet;
    return this.changeState(state);
  }

  private rotateTablet(uuid: string): GameInterface.ValidateError | null {
    const state = this.player;
    const tablet = [...state.tablets, ...state.inventory].find(
      (item) => item?.uuid === uuid,
    );
    if (!tablet || !("rotate" in tablet)) return null;
    const rotations = [0, 90, 180, 270] as const;
    tablet.rotate =
      rotations[(rotations.indexOf(tablet.rotate) + 1) % rotations.length]!;
    return this.changeState(state);
  }

  private claimLoot(loot: PendingLootItem, count?: number): void {
    if (this.destroyed) return;
    this.game.openLoots(loot, count);
    this.afterPlayerChange();
  }

  private get tutorialPending(): boolean {
    const player = this.player;
    return (
      !player.tutorial.completed.includes(EQUIP_SKILL_TUTORIAL) ||
      levelTutorialPending(player)
    );
  }

  private afterPlayerChange(): void {
    if (this.tutorialPending) this.stopTimer();
    this.battle.changeState(this.player);
    this.publish();
  }

  private advance(): void {
    if (this.destroyed || !this.started || this.tutorialPending) return;
    this.log = this.battle.executeFrame();
    if (this.log.status !== "Running") {
      const outcome = this.log.status;
      const settlement = this.game.battleResult({
        uuid: this.task.uuid,
        result: outcome,
        frame: this.log.frame,
      });
      if (levelTutorialPending(this.player)) this.stopTimer();
      else
        this.replaceBattle(this.game.startLevel(this.nextBattleLevel(outcome)));
      this.view.showBattleResult(this.result(settlement, outcome));
    }
    this.publish();
  }

  private nextBattleLevel(outcome: "Victory" | "Defeat"): MapLevel {
    const player = this.player;
    const current = this.task.spec.level;
    if (outcome !== "Victory" || !player.config.autoAdvanceLevel)
      return current;
    const compare = (a: MapLevel, b: MapLevel) => a[0] - b[0] || a[1] - b[1];
    // Settlement may unlock another level, so compare against the battle's starting progress.
    if (compare(current, this.task.player.highestUnlockedMapLevel) !== 0)
      return current;
    return (
      this.data.mapLevelDefinitions
        .map((definition) => definition.level)
        .filter(
          (level) =>
            compare(level, current) > 0 &&
            compare(level, player.highestUnlockedMapLevel) <= 0,
        )
        .sort(compare)[0] ?? current
    );
  }

  private replaceBattle(task: GameInterface.Battle): void {
    this.task = task;
    this.view.resetBattle({ transition: true });
    this.battle = new Battle(this.data, this.task.spec, this.player);
    this.log = this.battle.renderLog();
  }

  private result(
    settlement: BattleSettlement,
    outcome: "Victory" | "Defeat",
  ): BattlefieldResult {
    const kinds = {
      "tablet-skill": "skill",
      "tablet-passive": "passive",
      "tablet-support-skill": "support-skill",
      "tablet-support-passive": "support-passive",
    } as const;
    const rewards: BattlefieldResult["rewards"][number][] = [];
    for (const item of settlement.items) {
      const kind = kinds[item.kind];
      const reward = rewards.find((entry) => entry.kind === kind);
      if (reward) reward.count += 1;
      else rewards.push({ kind, count: 1 });
    }
    if (settlement.pendingLoot.length)
      rewards.push({ kind: "pending", count: settlement.pendingLoot.length });
    return { outcome, xpGain: settlement.xpGain, rewards };
  }

  private stopTimer(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private publish(): void {
    if (this.destroyed) return;
    this.view.update({
      player: this.player,
      battle: {
        log: this.log,
        spec: this.task.spec,
        playing: this.timer !== undefined,
        frameDuration: this.frameDuration,
      },
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopTimer();
    this.view.destroy();
  }
}
