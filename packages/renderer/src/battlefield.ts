import { Application, Container, Graphics, Sprite, Text } from "pixi.js";
import { loadBattlefieldAssets } from "./battlefield-assets.js";
import type { BattlefieldAssets, CharacterTextures } from "./battlefield-assets.js";
import { createSkillEffect } from "./effects/index.js";
import type { SkillEffect } from "./effects/index.js";
import type { BattleEvent, BattleLog } from "@infinite-build/core";

type Unit = BattleLog["units"][number];
type View = {
  root: Container;
  body: Sprite;
  poses: CharacterTextures;
  actionUntil: number;
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
  private readonly background = new Container();
  private readonly backgroundTiles: Sprite[] = [];
  private readonly actors = new Container();
  private readonly playerLayer = new Container();
  private readonly effectsLayer = new Container();
  private readonly overlay = new Container();
  private readonly skillLayer = new Container();
  private readonly skillBars: { progress: number; track: Graphics; label: Text; color: number }[] = [];
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
  private origin = 0;
  private fromOrigin = 0;
  private destroyed = false;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: BattlefieldAssets,
  ) {
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
    view.app.stage.addChild(view.background, world, view.clip, view.overlay, view.skillLayer, view.playerLayer);
    view.observer.observe(canvas);
    view.app.ticker.add(() => view.draw());
    canvas.dataset.renderer = "pixi";
    return view;
  }

  private text(value: string, size: number, fill: number): Text {
    return new Text({ text: value, style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill } });
  }

  update(log: BattleLog, options: BattlefieldOptions): void {
    const now = performance.now();
    // UI changes must not replay events or rewind effects when pausing.
    if (this.log === log) {
      this.frameOffset = this.subframe(now);
      this.timelineAt = now;
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
      view.position = unit.position;
      view.health.clear().rect(-19, -40, 38, 4).fill(0x25324b);
      const ratio = Math.max(0, Math.min(1, unit.hp / (unit.status.attributes.maxHp || 1)));
      if (ratio > 0) view.health.rect(-19, -40, 38 * ratio, 4).fill(ratio < 0.3 ? 0xff718a : 0x7ee2ba);
    }
    const ids = new Set(log.units.map((unit) => unit.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id) && view.deadAt === undefined) view.deadAt = now;
    }
    this.log = log;
    this.updatedAt = now;
    this.timelineAt = now;
    this.frameOffset = 0;
    this.options = options;
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
        view.hitAt = now;
        const text = this.text(`−${Number(event.damage.toFixed(2))}`, 15, 0xffa1a6);
        text.style.fontWeight = "bold";
        text.anchor.set(0.5);
        this.overlay.addChild(text);
        this.damage.push({ text, position: view.position, y: this.unitY(event.dst, view.kind) - 45, start: now });
      }
    }
  }

  reset(): void {
    this.clearSkillBars();
    for (const view of this.views.values()) view.root.destroy({ children: true });
    for (const entry of this.damage) entry.text.destroy();
    this.views.clear();
    this.damage = [];
    for (const effect of this.effects) effect.sprite.destroy();
    this.effects = [];
    this.log = undefined;
    this.origin = this.fromOrigin = 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    this.app.destroy(false, { children: true });
  }

  private resize(): void {
    if (this.destroyed) return;
    this.app.renderer.resize(
      Math.max(1, this.canvas.clientWidth),
      Math.max(1, this.canvas.clientHeight),
      Math.min(window.devicePixelRatio || 1, 2),
    );
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
      const color = event.skill === "nova" ? 0xc49aff : 0xffbb73;
      const track = new Graphics();
      const name = this.options.skillNames?.[event.skill] ?? "未知技能";
      const label = this.text(`${name}  ${Math.round(progress * 100)}%`, 11, 0xe6ecfa);
      this.skillLayer.addChild(track, label);
      this.skillBars.push({ progress, track, label, color });
    }
  }

  private drawSkillBars(width: number, height: number): void {
    const padding = 12;
    const gap = 8;
    const itemWidth = Math.min(116, Math.max(1, width - padding * 2));
    const columns = Math.max(1, Math.min(this.skillBars.length, Math.floor((width - padding * 2 + gap) / (itemWidth + gap))));
    const rows = Math.ceil(this.skillBars.length / columns);
    for (const [index, bar] of this.skillBars.entries()) {
      const x = padding + (index % columns) * (itemWidth + gap);
      const y = height - padding - (rows - Math.floor(index / columns)) * 32;
      const centerX = x + 12;
      const centerY = y + 16;
      const radius = 12;
      bar.track.clear().circle(centerX, centerY, radius).fill(0x34425a);
      if (bar.progress >= 1) {
        bar.track.circle(centerX, centerY, radius).fill(bar.color);
      } else if (bar.progress > 0) {
        // Start at twelve o'clock and fill clockwise using the logged cast progress.
        bar.track.moveTo(centerX, centerY)
          .arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bar.progress)
          .closePath().fill(bar.color);
      }
      bar.track.circle(centerX, centerY, radius).stroke({ color: bar.color, width: 1, alpha: 0.7 });
      bar.label.position.set(x + 30, y + 9);
      bar.label.scale.set(1);
      bar.label.scale.set(Math.min(1, Math.max(1, itemWidth - 30) / bar.label.width));
    }
  }

  private subframe(now: number): number {
    return Math.min(1, this.frameOffset + (this.options.playing
      ? Math.max(0, now - this.timelineAt) / this.options.frameDuration
      : 0));
  }

  private progress(now: number): number {
    return Math.min(1, Math.max(0, (now - this.updatedAt) / Math.min(this.options.frameDuration, 250)));
  }

  private unitY(id: number, kind: string): number {
    const height = this.app.screen.height;
    return kind === "Player" ? height * 0.55 : height * (0.34 + (id % 4) * 0.115);
  }

  private createUnit(unit: Unit): View {
    const root = new Container();
    const poses = this.assets.characters[unit.kind] ?? this.assets.characters.Goblin!;
    const body = new Sprite({ texture: poses.idle, roundPixels: true });
    body.anchor.set(0.5, 1);
    body.scale.set(0.18);
    body.y = 20;
    const shadow = new Graphics().ellipse(0, 20, 20, 5).fill({ color: 0x000000, alpha: 0.25 });
    const health = new Graphics();
    const label = this.text(`${unit.kind} #${unit.id}`, 10, 0xb3c2dc);
    label.anchor.set(0.5);
    label.y = -49;
    root.addChild(shadow, body, health, label);
    (unit.kind === "Player" ? this.playerLayer : this.actors).addChild(root);
    return {
      root, body, poses, health, label,
      from: unit.position, position: unit.position, kind: unit.kind,
      hitAt: -Infinity, actionUntil: 0,
    };
  }

  private addEffect(event: BattleEvent.Effect, previous?: BattleLog): void {
    const source = this.views.get(event.source);
    const effect = createSkillEffect(event, {
      assets: this.assets,
      log: this.log!,
      previous,
      sourceY: this.unitY(event.source, source?.kind ?? "Player"),
      unitY: (id, kind) => this.unitY(id, kind),
    });
    if (!effect) return;
    if (source) source.actionUntil = performance.now() + 280;
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
      tile.position.set(Math.round(index * tileWidth - phase), height);
    }
  }

  private draw(): void {
    if (!this.log) return;
    const now = performance.now();
    const progress = this.progress(now);
    const origin = this.fromOrigin + (this.origin - this.fromOrigin) * progress;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const left = Math.min(48, width * 0.1);
    const right = width - left;
    const x = (position: number) => left + (position - origin + 2) / (this.options.vision + 4) * (right - left);
    this.drawBackground(origin, width, height, (right - left) / (this.options.vision + 4));
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
    this.drawSkillBars(width, height);
    for (const [id, view] of this.views) {
      const position = view.from + (view.position - view.from) * progress;
      const moving = Math.abs(view.position - view.from) > 0.001 && progress < 1;
      const bounce = moving ? Math.sin(progress * Math.PI * 2) * 3 : Math.sin(now / 500 + id) * 1.2;
      view.root.position.set(Math.round(x(position)), Math.round(this.unitY(id, view.kind)));
      const walking = moving && Math.floor(now / 160) % 2 === 1;
      view.body.texture = now < view.actionUntil || walking ? view.poses.action : view.poses.idle;
      view.body.y = 20 + Math.round(bounce);
      view.body.scale.set(0.18);
      const hit = Math.max(0, 1 - (now - view.hitAt) / 220);
      view.body.tint = hit > 0.2 ? 0xffa0a8 : 0xffffff;
      view.body.x = hit * Math.sin(now / 15) * 3;
      if (view.deadAt !== undefined) {
        const death = Math.min(1, (now - view.deadAt) / 450);
        view.root.alpha = 1 - death;
        view.body.rotation = death * 0.6;
        view.body.scale.set(0.18 * (1 + death * 0.3), 0.18 * (1 - death * 0.65));
        if (death === 1) {
          view.root.destroy({ children: true });
          this.views.delete(id);
        }
      }
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
      entry.text.position.set(x(entry.position), entry.y - t * 30);
      entry.text.alpha = Math.min(1, (1 - t) * 3);
      return true;
    });
  }
}
