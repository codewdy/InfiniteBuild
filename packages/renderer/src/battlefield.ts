import { Position } from "@infinite-build/core";
import { BattleTransition } from "./battlefield/transition.js";
import { BattleSkillEffects } from "./battlefield/skill-effects.js";
import { BattleDamageText } from "./battlefield/damage-text.js";
import { BattlefieldBackground } from "./battlefield/background.js";
import { BattleProgress } from "./battlefield/progress.js";
import { SkillBar } from "./battlefield/skill-bar.js";
import { BattlefieldUnits } from "./battlefield/units.js";
import { REFERENCE_HEIGHT, UNIT_SIZE_FACTOR } from "./battlefield/layout.js";
import type {
  BattlefieldOptions,
  BattlefieldState,
  BattlefieldResetOptions,
} from "./types.js";
import { Application, Container, Graphics } from "pixi.js";
import { MonsterInfo } from "./monster-info.js";
import { BattleResultOverlay } from "./battle-result.js";
import type { BattlefieldResult } from "./types.js";
import { loadBattlefieldAssets } from "@infinite-build/assets";
import type { BattlefieldAssets } from "@infinite-build/assets";
import type { BattleLog } from "@infinite-build/core";

/** Presentation only: battle logs remain the authority for time and positions. */
export class Battlefield {
  private readonly app = new Application();
  private readonly scene = new Container();
  private readonly viewport = new Container();
  private readonly viewportClip = new Graphics();
  private viewportSize?: { width: number; height: number };
  private readonly transition = new BattleTransition(this.scene);
  private readonly background = new BattlefieldBackground();
  private readonly units: BattlefieldUnits;
  private readonly skillEffects: BattleSkillEffects;
  private readonly damageText = new BattleDamageText();
  private skillLayer!: SkillBar;
  private readonly battleProgress: BattleProgress;
  private readonly resultOverlay: BattleResultOverlay;
  private readonly monsterInfo = new MonsterInfo();
  private readonly onInfoKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.monsterInfo.hide();
    }
  };
  private readonly clip = new Graphics();
  private readonly observer: ResizeObserver;
  private log?: BattleLog;
  private options: Omit<BattlefieldState, "log"> = {
    background: "",
    frameDuration: 200,
    playing: false,
  };
  private updatedAt = 0;
  private timelineAt = 0;
  private frameOffset = 0;
  private skillFrameOffset = 0;
  private skillTimelineAt = 0;
  private skillProgressPlaying = false;
  private origin: Position = { x: 0, y: 0 };
  private fromOrigin: Position = { x: 0, y: 0 };
  private destroyed = false;
  private animationTime = 0;
  private frameAnimationTime = 0;
  private animationUpdatedAt = performance.now();
  private animateUntil = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: BattlefieldAssets,
    private readonly config: BattlefieldOptions,
  ) {
    this.resultOverlay = new BattleResultOverlay(assets.settlement);
    this.battleProgress = new BattleProgress(
      assets,
      () => this.log?.status === "Running" && !this.transition.active,
      config.onTogglePlaying,
    );
    this.units = new BattlefieldUnits(assets, (kind, event) => {
      const definition = config.unitDefinitions?.[kind];
      if (!definition) return;
      event.stopPropagation();
      this.monsterInfo.show(
        definition,
        assets.characters[kind],
        config.skillDefinitions ?? {},
      );
      this.monsterInfo.layout(this.width, this.height);
    });
    this.skillEffects = new BattleSkillEffects(
      assets,
      this.units,
      () => this.height,
    );
    this.observer = new ResizeObserver(() => this.resize());
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: BattlefieldOptions,
  ): Promise<Battlefield> {
    const view = new Battlefield(
      canvas,
      await loadBattlefieldAssets(),
      options,
    );
    await view.app.init({
      canvas,
      width: Math.max(1, canvas.clientWidth),
      height: Math.max(1, canvas.clientHeight),
      background: 0x0d1424,
      antialias: false,
      roundPixels: true,
      // CSS owns the display size; resolution controls the backing buffer.
      autoDensity: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
    });
    view.skillLayer = new SkillBar(view.app.renderer, view.assets, options);
    const world = new Container();
    world.addChild(view.units.actors, view.skillEffects);
    world.mask = view.clip;
    // Keep the player above skill effects and floating damage text.
    view.scene.addChild(
      view.background,
      world,
      view.clip,
      view.damageText,
      view.skillLayer,
      view.units.playerLayer,
      view.battleProgress,
    );
    view.viewport.addChild(
      view.scene,
      view.transition,
      view.resultOverlay,
      view.monsterInfo,
    );
    view.viewport.mask = view.viewportClip;
    view.app.stage.addChild(view.viewport, view.viewportClip);
    view.viewportClip
      .rect(0, 0, view.app.screen.width, view.app.screen.height)
      .fill(0xffffff);
    view.observer.observe(canvas);
    view.app.ticker.add(() => view.draw());
    window.addEventListener("keydown", view.onInfoKeyDown);
    canvas.dataset.renderer = "pixi";
    return view;
  }

  /** Mount application UI above the battlefield and settlement layers. */
  mountOverlay(view: Container): void {
    this.app.stage.addChild(view);
  }

  /** Restrict battlefield presentation while leaving room for UI on the same canvas. */
  setViewport(width: number, height: number): void {
    this.viewportSize = {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
    this.viewportClip
      .clear()
      .rect(0, 0, this.viewportSize.width, this.viewportSize.height)
      .fill(0xffffff);
  }

  private get width(): number {
    return this.viewportSize?.width ?? this.app.screen.width;
  }
  private get height(): number {
    return this.viewportSize?.height ?? this.app.screen.height;
  }

  update(state: BattlefieldState): void {
    const { log, ...options } = state;
    const background = this.assets.backgrounds[options.background];
    if (!background)
      throw new Error(`Unknown battle background: ${options.background}`);
    this.background.setTexture(background);
    const now = performance.now();
    this.advanceAnimations(now);
    // UI changes must not replay events or rewind effects when pausing.
    if (this.log === log) {
      this.frameOffset = this.subframe(now);
      this.skillFrameOffset = this.skillSubframe(now);
      this.skillTimelineAt = now;
      if (this.options.playing !== options.playing) {
        this.skillProgressPlaying = options.playing;
      }
      this.timelineAt = now;
      if (this.options.playing && !options.playing && log.status === "Running")
        this.animateUntil = this.animationTime;
      this.options = options;
      return;
    }
    const previous = this.log;
    const progress = this.progress(now);
    this.fromOrigin = Position.lerp(this.fromOrigin, this.origin, progress);
    this.origin =
      log.units.find((unit) => unit.kind === "Player")?.position ?? this.origin;
    this.units.update(log, progress, this.animationTime);
    this.log = log;
    this.frameAnimationTime = this.animationTime;
    this.updatedAt = now;
    this.timelineAt = now;
    this.frameOffset = 0;
    this.skillFrameOffset = log.status === "Running" ? 0 : 1;
    this.skillTimelineAt = now;
    // A manual step also plays one complete sweep; pausing freezes its position.
    this.skillProgressPlaying = log.status === "Running";
    this.options = options;
    // A manual step plays its feedback once; a pause on the same log freezes it.
    // Final death animations can finish while the settlement is displayed.
    if (!options.playing || log.status !== "Running") {
      this.animateUntil = this.animationTime + 800;
    }
    this.skillLayer.update(log);
    this.skillEffects.update(log);
    for (const event of log.events) {
      this.units.handleEvent(event, this.animationTime);
      if (event.kind === "Effect")
        this.skillEffects.playEffect(event, log, previous);
      if (event.kind === "Damage") {
        const target = this.units.get(event.dst);
        if (target) this.damageText.addDamage(event, target.position, now);
      }
    }
  }

  showBattleResult(result: BattlefieldResult, durationMs: number = 1000): void {
    if (this.destroyed) return;
    this.resultOverlay.show(result, durationMs);
  }

  reset({ transition = false }: BattlefieldResetOptions = {}): void {
    this.transition.reset();
    if (transition && this.log) {
      this.draw();
      this.transition.capture(this.app.renderer, this.width, this.height);
    }
    this.resultOverlay.hide();
    this.monsterInfo.hide(true);
    this.skillLayer.reset();
    this.units.reset();
    this.skillEffects.reset();
    this.damageText.reset();
    this.log = undefined;
    this.battleProgress.reset();
    this.skillFrameOffset = 0;
    this.skillProgressPlaying = false;
    this.animationTime = this.animateUntil = 0;
    this.animationUpdatedAt = performance.now();
    this.origin = this.fromOrigin = { x: 0, y: 0 };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    window.removeEventListener("keydown", this.onInfoKeyDown);
    this.transition.reset();
    this.skillLayer.dispose();
    this.app.destroy(false, { children: true });
  }

  private resize(): void {
    if (this.destroyed) return;
    this.app.renderer.resize(
      Math.max(1, this.canvas.clientWidth),
      Math.max(1, this.canvas.clientHeight),
      Math.min(window.devicePixelRatio || 1, 2),
    );
    this.viewportClip
      .clear()
      .rect(0, 0, this.width, this.height)
      .fill(0xffffff);
  }

  private subframe(now: number): number {
    return Math.min(
      1,
      this.frameOffset +
        (this.options.playing
          ? Math.max(0, now - this.timelineAt) / this.options.frameDuration
          : 0),
    );
  }

  private skillSubframe(now: number): number {
    return Math.min(
      1,
      this.skillFrameOffset +
        (this.skillProgressPlaying
          ? Math.max(0, now - this.skillTimelineAt) / this.options.frameDuration
          : 0),
    );
  }

  private progress(now: number): number {
    return Math.min(
      1,
      Math.max(
        0,
        (now - this.updatedAt) / Math.min(this.options.frameDuration, 250),
      ),
    );
  }

  private advanceAnimations(now: number): void {
    const elapsed = Math.max(0, now - this.animationUpdatedAt);
    this.animationUpdatedAt = now;
    const speed = Math.max(1, Math.min(4, 200 / this.options.frameDuration));
    if (this.options.playing && this.log?.status === "Running") {
      this.animationTime += elapsed * speed;
    } else {
      this.animationTime = Math.min(
        this.animateUntil,
        this.animationTime + elapsed * speed,
      );
    }
  }

  private draw(): void {
    const now = performance.now();
    this.advanceAnimations(now);
    this.transition.draw(now, this.width, this.height);
    this.resultOverlay.update(now, this.width, this.height);
    this.monsterInfo.layout(this.width, this.height);
    if (!this.log) return;
    const progress = this.progress(now);
    const origin = Position.lerp(this.fromOrigin, this.origin, progress);
    const width = this.width;
    const height = this.height;
    const left = Math.min(48, width * 0.1);
    const right = width - left;
    const top = Math.min(48, height * 0.1);
    const bottom = height - top;
    const vision = this.config.vision;
    const visionWidth = vision.left + vision.right + 4;
    const visionHeight = vision.top + vision.bottom + 4;
    const scale = Math.min(
      (right - left) / visionWidth,
      (bottom - top) / visionHeight,
    );
    const offsetX = left + (right - left - visionWidth * scale) / 2;
    const offsetY = top + (bottom - top - visionHeight * scale) / 2;
    const x = (position: Position) =>
      offsetX + (position.x - origin.x + vision.left + 2) * scale;
    const y = (position: Position) =>
      offsetY + (position.y + vision.top + 2) * scale;
    this.background.draw(origin.x, width, height, scale);
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
    this.skillLayer.draw(width, height, this.skillSubframe(now));
    this.battleProgress.draw(
      width,
      height,
      this.log,
      this.options,
      this.transition.active,
    );
    this.units.draw(
      progress,
      x,
      y,
      (height / REFERENCE_HEIGHT) * UNIT_SIZE_FACTOR,
      this.animationTime,
      this.options.playing && this.log.status === "Running",
    );
    this.skillEffects.draw(
      this.log,
      this.log.frame +
        (this.log.status === "Running"
          ? this.subframe(now)
          : (this.animationTime - this.frameAnimationTime) / 200),
      progress,
      x,
      y,
    );
    this.damageText.draw(x, y, height, now);
  }
}
