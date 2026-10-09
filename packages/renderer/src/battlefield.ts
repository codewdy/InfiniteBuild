import { Application, Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import { BattleResultOverlay } from "./battle-result.js";
import type { BattlefieldResult } from "./battle-result.js";
import { loadBattlefieldAssets } from "./battlefield-assets.js";
import type { BattlefieldAssets, CharacterAnimation, CharacterTextures } from "./battlefield-assets.js";
import { createSkillEffect } from "./effects/index.js";
import type { SkillEffect } from "./effects/index.js";
import type { BattleEvent, BattleLog } from "@infinite-build/core";

// Preserve the original character proportions at the reference battlefield height.
const UNIT_REFERENCE_HEIGHT = 290;
const UNIT_SIZE_FACTOR = 0.75;

type Unit = BattleLog["units"][number];
type View = {
  root: Container;
  body: Sprite;
  poses: CharacterTextures;
  action?: { kind: "cast" | "attack"; startedAt: number };
  animation: CharacterAnimation;
  facing: number;
  walking: boolean;
  walkAt: number;
  walkUntil: number;
  shadow: Graphics;
  health: Graphics;
  label: Text;
  from: number;
  position: number;
  kind: string;
  hitAt: number;
  deadAt?: number;
};
type Damage = { text: Text; position: number; y: number; start: number };

export type BattlefieldOptions = {
  vision: number;
  frameDuration: number;
  playing: boolean;
  skillNames?: Readonly<Record<string, string>>;
};

/** Presentation only: battle logs remain the authority for time and positions. */
export class Battlefield {
  private readonly app = new Application();
  private readonly scene = new Container();
  private readonly viewport = new Container();
  private readonly viewportClip = new Graphics();
  private viewportSize?: { width: number; height: number };
  private readonly transitionLayer = new Container();
  private transition?: { snapshot: Sprite; startedAt: number };
  private readonly background = new Container();
  private readonly backgroundTiles: Sprite[] = [];
  private readonly actors = new Container();
  private readonly playerLayer = new Container();
  private readonly effectsLayer = new Container();
  private readonly overlay = new Container();
  private readonly skillLayer = new Container();
  private readonly resultOverlay: BattleResultOverlay;
  private readonly skillBars: {
    progress: number;
    castRate: number;
    root: Container;
    icon: Sprite;
    shade: Sprite;
    mask: Graphics;
  }[] = [];
  private readonly clip = new Graphics();
  private readonly views = new Map<number, View>();
  private readonly observer: ResizeObserver;
  private log?: BattleLog;
  private options: BattlefieldOptions = { vision: 20, frameDuration: 200, playing: false };
  private effects: SkillEffect[] = [];
  private damage: Damage[] = [];
  private updatedAt = 0;
  private timelineAt = 0;
  private frameOffset = 0;
  private skillFrameOffset = 0;
  private skillTimelineAt = 0;
  private skillProgressPlaying = false;
  private origin = 0;
  private fromOrigin = 0;
  private destroyed = false;
  private animationTime = 0;
  private animationUpdatedAt = performance.now();
  private animateUntil = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: BattlefieldAssets,
  ) {
    this.resultOverlay = new BattleResultOverlay(assets.settlement);
    // Two tiles cover any viewport because each tile is at least viewport-wide.
    for (let index = 0; index < 2; index++) {
      const tile = new Sprite({ texture: assets.background, roundPixels: true });
      this.backgroundTiles.push(tile);
      this.background.addChild(tile);
    }
    this.observer = new ResizeObserver(() => this.resize());
  }

  static async create(canvas: HTMLCanvasElement): Promise<Battlefield> {
    const view = new Battlefield(canvas, await loadBattlefieldAssets());
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
    const world = new Container();
    world.addChild(view.actors, view.effectsLayer);
    world.mask = view.clip;
    // Keep the player above skill effects and floating damage text.
    view.scene.addChild(view.background, world, view.clip, view.overlay, view.skillLayer, view.playerLayer);
    view.viewport.addChild(view.scene, view.transitionLayer, view.resultOverlay);
    view.viewport.mask = view.viewportClip;
    view.app.stage.addChild(view.viewport, view.viewportClip);
    view.viewportClip.rect(0, 0, view.app.screen.width, view.app.screen.height).fill(0xffffff);
    view.observer.observe(canvas);
    view.app.ticker.add(() => view.draw());
    canvas.dataset.renderer = "pixi";
    return view;
  }

  /** Mount application UI above the battlefield and settlement layers. */
  mountOverlay(view: Container): void {
    this.app.stage.addChild(view);
  }

  /** Restrict battlefield presentation while leaving room for UI on the same canvas. */
  setViewport(width: number, height: number): void {
    this.viewportSize = { width: Math.max(1, width), height: Math.max(1, height) };
    this.viewportClip.clear().rect(0, 0, this.viewportSize.width, this.viewportSize.height).fill(0xffffff);
  }

  private get width(): number { return this.viewportSize?.width ?? this.app.screen.width; }
  private get height(): number { return this.viewportSize?.height ?? this.app.screen.height; }

  private text(value: string, size: number, fill: number): Text {
    return new Text({ text: value, style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill } });
  }

  update(log: BattleLog, options: BattlefieldOptions): void {
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
      if (this.options.playing && !options.playing) this.animateUntil = this.animationTime;
      this.options = options;
      return;
    }
    const previous = this.log;
    const progress = this.progress(now);
    this.fromOrigin += (this.origin - this.fromOrigin) * progress;
    this.origin = log.units.find((unit) => unit.kind === "Player")?.position ?? this.origin;
    for (const unit of log.units) {
      let view = this.views.get(unit.id);
      if (!view) {
        view = this.createUnit(unit);
        this.views.set(unit.id, view);
      }
      view.from += (view.position - view.from) * progress;
      const displacement = unit.position - view.position;
      const walking = Math.abs(displacement) > 0.001;
      if (walking) view.facing = Math.sign(displacement);
      if (walking && !view.walking) view.walkAt = this.animationTime;
      if (walking) view.walkUntil = this.animationTime + 200;
      view.walking = walking;
      view.position = unit.position;
      if (unit.hp <= 0 && view.deadAt === undefined) view.deadAt = this.animationTime;
      view.label.text = unit.name;
      view.health.clear().rect(-19, -40, 38, 4).fill(0x25324b);
      const ratio = Math.max(0, Math.min(1, unit.hp / (unit.status.attributes.maxHp || 1)));
      if (ratio > 0) view.health.rect(-19, -40, 38 * ratio, 4).fill(ratio < 0.3 ? 0xff718a : 0x7ee2ba);
    }
    const ids = new Set(log.units.map((unit) => unit.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id) && view.deadAt === undefined) view.deadAt = this.animationTime;
    }
    this.log = log;
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
    this.updateSkillBars(log);
    this.effects = this.effects.filter((effect) => {
      if (log.frame - effect.start < effect.duration) return true;
      effect.sprite.destroy();
      return false;
    });
    for (const event of log.events) {
      if (event.kind === "Effect") this.addEffect(event, previous);
      if (event.kind === "Damage") {
        const view = this.views.get(event.dst);
        if (!view) continue;
        if (event.damage > 0) view.hitAt = this.animationTime;
        const text = this.text(`−${Number(event.damage.toFixed(2))}`, 15, 0xffa1a6);
        text.style.fontWeight = "bold";
        text.anchor.set(0.5);
        this.overlay.addChild(text);
        this.damage.push({ text, position: view.position, y: this.unitY(event.dst, view.kind) / this.height, start: now });
      }
    }
  }

  showBattleResult(result: BattlefieldResult, durationMs: number = 1000): void {
    if (this.destroyed) return;
    this.resultOverlay.show(result, durationMs);
  }

  reset(fadeToNextBattle: boolean = false): void {
    this.clearTransition();
    if (fadeToNextBattle && this.log) {
      this.draw();
      const snapshot = new Sprite(this.app.renderer.generateTexture({
        target: this.scene,
        frame: new Rectangle(0, 0, this.width, this.height),
        resolution: this.app.renderer.resolution,
      }));
      this.transitionLayer.addChild(snapshot);
      this.transition = { snapshot, startedAt: performance.now() };
      this.scene.alpha = 0;
    }
    this.resultOverlay.hide();
    this.clearSkillBars();
    for (const view of this.views.values()) view.root.destroy({ children: true });
    for (const entry of this.damage) entry.text.destroy();
    this.views.clear();
    this.damage = [];
    for (const effect of this.effects) effect.sprite.destroy();
    this.effects = [];
    this.log = undefined;
    this.skillFrameOffset = 0;
    this.skillProgressPlaying = false;
    this.animationTime = this.animateUntil = 0;
    this.animationUpdatedAt = performance.now();
    this.origin = this.fromOrigin = 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    this.clearTransition();
    this.app.destroy(false, { children: true });
  }

  private clearTransition(): void {
    if (this.transition) {
      const texture = this.transition.snapshot.texture;
      this.transition.snapshot.destroy();
      texture.destroy(true);
      this.transition = undefined;
    }
    this.scene.alpha = 1;
  }

  private drawTransition(now: number): void {
    if (!this.transition) return;
    const progress = Math.min(1, Math.max(0, (now - this.transition.startedAt) / 500));
    if (progress >= 1) {
      this.clearTransition();
      return;
    }
    const fadeOut = Math.min(1, progress * 2);
    const fadeIn = Math.max(0, progress * 2 - 1);
    const smooth = (value: number) => value * value * (3 - 2 * value);
    this.transition.snapshot.alpha = 1 - smooth(fadeOut);
    this.transition.snapshot.width = this.width;
    this.transition.snapshot.height = this.height;
    this.scene.alpha = smooth(fadeIn);
  }

  private resize(): void {
    if (this.destroyed) return;
    this.app.renderer.resize(
      Math.max(1, this.canvas.clientWidth),
      Math.max(1, this.canvas.clientHeight),
      Math.min(window.devicePixelRatio || 1, 2),
    );
    this.viewportClip.clear().rect(0, 0, this.width, this.height).fill(0xffffff);
  }

  private clearSkillBars(): void {
    for (const child of this.skillLayer.removeChildren()) child.destroy({ children: true });
    this.skillBars.length = 0;
  }

  private updateSkillBars(log: BattleLog): void {
    this.clearSkillBars();
    for (const event of log.events) {
      if (event.kind !== "PlayerSkillProgress") continue;
      const progress = Math.max(0, Math.min(1, event.progress));
      const texture = this.assets.skillTablets[event.skill] ?? this.assets.settlement.rewards.skill;
      const root = new Container();
      const icon = new Sprite({ texture, roundPixels: true });
      const shade = new Sprite({ texture, tint: 0x000000, alpha: 0.68, roundPixels: true });
      const mask = new Graphics();
      icon.anchor.set(0.5);
      shade.anchor.set(0.5);
      shade.mask = mask;
      const name = this.options.skillNames?.[event.skill] ?? "未知技能";
      root.label = `${name} ${Math.round(progress * 100)}% (${event.uuid})`;
      root.addChild(icon, shade, mask);
      this.skillLayer.addChild(root);
      this.skillBars.push({ progress, castRate: event.castRate, root, icon, shade, mask });
    }
  }

  private drawSkillBars(width: number, height: number, frameProgress: number): void {
    const padding = 12;
    const gap = 8;
    const itemWidth = Math.min(44, Math.max(1, width - padding * 2));
    const columns = Math.max(1, Math.min(this.skillBars.length, Math.floor((width - padding * 2 + gap) / (itemWidth + gap))));
    const rows = Math.ceil(this.skillBars.length / columns);
    for (const [index, bar] of this.skillBars.entries()) {
      // The log is the end of this frame. Sweep forward by castRate to reach it.
      const accumulated = bar.progress - bar.castRate * (1 - frameProgress);
      const progress = frameProgress >= 1 || bar.castRate === 0
        ? bar.progress : ((accumulated % 1) + 1) % 1;
      const x = padding + (index % columns) * (itemWidth + gap);
      const y = height - padding - (rows - Math.floor(index / columns)) * (itemWidth + gap) + gap;
      bar.root.position.set(x + itemWidth / 2, y + itemWidth / 2);
      bar.icon.width = bar.icon.height = itemWidth;
      bar.shade.width = bar.shade.height = itemWidth;
      // The dark copy preserves the stone's transparent silhouette. The sector
      // reveals it clockwise from twelve o'clock as the logged progress fills.
      const radius = itemWidth / Math.SQRT2 + 1;
      bar.mask.clear();
      bar.shade.visible = progress < 1;
      if (progress <= 0) {
        bar.mask.circle(0, 0, radius).fill(0xffffff);
      } else if (progress < 1) {
        bar.mask.moveTo(0, 0)
          .arc(0, 0, radius, -Math.PI / 2 + Math.PI * 2 * progress, Math.PI * 1.5)
          .closePath().fill(0xffffff);
      }
    }
  }

  private subframe(now: number): number {
    return Math.min(1, this.frameOffset + (this.options.playing
      ? Math.max(0, now - this.timelineAt) / this.options.frameDuration
      : 0));
  }

  private skillSubframe(now: number): number {
    return Math.min(1, this.skillFrameOffset + (this.skillProgressPlaying
      ? Math.max(0, now - this.skillTimelineAt) / this.options.frameDuration
      : 0));
  }

  private progress(now: number): number {
    return Math.min(1, Math.max(0, (now - this.updatedAt) / Math.min(this.options.frameDuration, 250)));
  }

  private get unitScale(): number { return this.height / UNIT_REFERENCE_HEIGHT * UNIT_SIZE_FACTOR; }

  private unitY(id: number, kind: string): number {
    const height = this.height;
    return kind === "Player" ? height * 0.55 : height * (0.34 + (id % 4) * 0.115);
  }

  private advanceAnimations(now: number): void {
    const elapsed = Math.max(0, now - this.animationUpdatedAt);
    this.animationUpdatedAt = now;
    const speed = Math.max(1, Math.min(4, 200 / this.options.frameDuration));
    if (this.options.playing && this.log?.status === "Running") {
      this.animationTime += elapsed * speed;
    } else {
      this.animationTime = Math.min(this.animateUntil, this.animationTime + elapsed * speed);
    }
  }

  private createUnit(unit: Unit): View {
    const root = new Container();
    const poses = this.assets.characters[unit.kind] ?? this.assets.characters.Goblin!;
    const body = new Sprite({ texture: poses.animations.idle.frames[0]!, roundPixels: true });
    body.anchor.set(0.5, 1);
    body.scale.set(poses.scale);
    body.y = 20;
    const shadow = new Graphics().ellipse(0, 20, 20, 5).fill({ color: 0x000000, alpha: 0.25 });
    const health = new Graphics();
    const label = this.text(unit.name, 10, 0xb3c2dc);
    label.anchor.set(0.5);
    label.y = -49;
    root.addChild(shadow, body, health, label);
    (unit.kind === "Player" ? this.playerLayer : this.actors).addChild(root);
    return {
      root, body, poses, health, label, shadow,
      from: unit.position, position: unit.position, kind: unit.kind,
      hitAt: -Infinity, animation: "idle", facing: unit.kind === "Player" ? 1 : -1,
      walking: false, walkAt: this.animationTime, walkUntil: this.animationTime,
    };
  }

  private addEffect(event: BattleEvent.Effect, previous?: BattleLog): void {
    const source = this.views.get(event.source);
    if (source && source.deadAt === undefined) {
      source.action = {
        kind: event.skill === "attack" || event.effect === "attack" ? "attack" : "cast",
        startedAt: this.animationTime,
      };
      const targetId = event.payload.to;
      const target = typeof targetId === "number" ? this.views.get(targetId) : undefined;
      if (target && target.position !== source.position) {
        source.facing = Math.sign(target.position - source.position);
      }
    }
    const unitY = (id: number, kind: string) => this.unitY(id, kind);
    const battlefield = this;
    const effect = createSkillEffect(event, {
      assets: this.assets,
      log: this.log!,
      previous,
      get sourceY() { return unitY(event.source, source?.kind ?? "Player"); },
      get unitScale() { return battlefield.unitScale; },
      unitY,
    });
    if (!effect) return;
    this.effectsLayer.addChild(effect.sprite);
    this.effects.push(effect);
  }

  private drawBackground(origin: number, width: number, height: number, pixelsPerUnit: number): void {
    const texture = this.assets.background;
    const tileWidth = Math.ceil(Math.max(width, height * texture.orig.width / texture.orig.height));
    const scale = tileWidth / texture.orig.width;
    // Follow the same interpolated camera as the actors, never elapsed wall time.
    const offset = origin * pixelsPerUnit + (tileWidth - width) / 2;
    const firstTile = Math.floor(offset / tileWidth);
    const phase = offset - firstTile * tileWidth;
    for (const [index, tile] of this.backgroundTiles.entries()) {
      const mirrored = (firstTile + index) % 2 !== 0;
      // Alternating direction makes neighboring edges identical without editing the PNG.
      tile.anchor.set(mirrored ? 1 : 0, 1);
      tile.scale.set(mirrored ? -scale : scale, scale);
      const bottom = height + Math.max(0, texture.orig.height * scale - height) / 2;
      tile.position.set(Math.round(index * tileWidth - phase), Math.round(bottom));
    }
  }

  private draw(): void {
    const now = performance.now();
    this.advanceAnimations(now);
    this.drawTransition(now);
    this.resultOverlay.update(now, this.width, this.height);
    if (!this.log) return;
    const progress = this.progress(now);
    const origin = this.fromOrigin + (this.origin - this.fromOrigin) * progress;
    const width = this.width;
    const height = this.height;
    const left = Math.min(48, width * 0.1);
    const right = width - left;
    const x = (position: number) => left + (position - origin + 2) / (this.options.vision + 4) * (right - left);
    this.drawBackground(origin, width, height, (right - left) / (this.options.vision + 4));
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
    this.drawSkillBars(width, height, this.skillSubframe(now));
    for (const [id, view] of this.views) {
      const position = view.from + (view.position - view.from) * progress;
      view.root.position.set(Math.round(x(position)), Math.round(this.unitY(id, view.kind)));
      this.drawUnit(view, id);
    }
    const subframe = this.subframe(now);
    for (const effect of this.effects) {
      const t = Math.max(0, Math.min(1, (this.log.frame + subframe - effect.start) / effect.duration));
      effect.sprite.visible = t < 1;
      if (t >= 1) continue;
      effect.update(t, {
        x,
        targetPosition: (id) => {
          const target = this.views.get(id);
          return target ? target.from + (target.position - target.from) * progress : undefined;
        },
      });
    }
    this.damage = this.damage.filter((entry) => {
      const t = (now - entry.start) / 850;
      if (t >= 1) { entry.text.destroy(); return false; }
      entry.text.scale.set(this.unitScale);
      entry.text.position.set(x(entry.position), entry.y * height - (45 + t * 30) * this.unitScale);
      entry.text.alpha = Math.min(1, (1 - t) * 3);
      return true;
    });
  }

  private drawUnit(view: View, id: number): void {
    view.root.scale.set(this.unitScale);
    const time = this.animationTime;
    const clips = view.poses.animations;
    let animation: CharacterAnimation = "idle";
    let elapsed = time;
    if (view.deadAt !== undefined) {
      animation = "death";
      elapsed = time - view.deadAt;
    } else if (time - view.hitAt < clips.hit.durationMs) {
      animation = "hit";
      elapsed = time - view.hitAt;
    } else if (view.action && time - view.action.startedAt < clips[view.action.kind].durationMs) {
      animation = view.action.kind;
      elapsed = time - view.action.startedAt;
    } else if (view.walking && (this.options.playing || time < view.walkUntil)) {
      animation = "walk";
      elapsed = time - view.walkAt;
    }
    const clip = clips[animation];
    const phase = Math.max(0, elapsed) / clip.durationMs;
    const frame = Math.min(clip.frames.length - 1,
      Math.floor((clip.loop ? phase % 1 : Math.min(phase, 1)) * clip.frames.length));
    view.animation = animation;
    view.body.texture = clip.frames[frame]!;
    view.body.scale.set(view.poses.scale * view.facing, view.poses.scale);
    view.body.rotation = 0;
    view.body.x = 0;
    view.body.y = 20 + (animation === "idle" ? Math.sin(time / 500 + id) : 0);
    view.body.tint = animation === "hit" && elapsed < 100 ? 0xffa0a8 : 0xffffff;
    view.health.visible = view.label.visible = animation !== "death";
    if (animation === "attack") {
      view.body.x = Math.sin(Math.min(1, phase) * Math.PI) * 7 * view.facing;
    }
    if (animation === "death") {
      // Hold the fallen pose briefly, then fade it; never loop a death clip.
      const fade = Math.max(0, Math.min(1, (elapsed - clip.durationMs) / 200));
      view.root.alpha = 1 - fade;
      view.shadow.alpha = 1 - fade;
      if (fade === 1) {
        view.root.destroy({ children: true });
        this.views.delete(id);
      }
    }
  }
}
