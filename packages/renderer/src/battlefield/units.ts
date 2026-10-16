import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type Text,
  type FederatedPointerEvent,
} from "pixi.js";
import type {
  BattlefieldAssets,
  CharacterAnimation,
  CharacterTextures,
} from "@infinite-build/assets";
import type { BattleEvent, BattleLog } from "@infinite-build/core";
import { createText } from "./text.js";
import { unitY } from "./layout.js";
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

export class BattlefieldUnits {
  readonly actors = new Container();
  readonly playerLayer = new Container();
  private readonly views = new Map<number, View>();
  constructor(
    private readonly assets: BattlefieldAssets,
    private readonly onInspect: (
      kind: string,
      event: FederatedPointerEvent,
    ) => void,
  ) {}
  get(
    id: number,
  ): Readonly<Pick<View, "from" | "position" | "kind">> | undefined {
    return this.views.get(id);
  }
  /** Apply unit animation changes in the order recorded by the battle log. */
  handleEvent(event: BattleEvent.Event, animationTime: number): void {
    if (event.kind === "Cast") this.addCast(event, animationTime);
    if (event.kind === "Effect") this.updateFacing(event);
    if (event.kind === "Damage" && event.damage > 0) {
      const view = this.views.get(event.dst);
      if (view) view.hitAt = animationTime;
    }
  }

  private addCast(event: BattleEvent.Cast, animationTime: number): void {
    const source = this.views.get(event.source);
    if (!source || source.deadAt !== undefined) return;
    source.action = {
      kind: this.assets.castAnimations[event.skill] ?? "cast",
      startedAt: animationTime,
    };
  }

  private updateFacing(event: BattleEvent.Effect): void {
    const source = this.views.get(event.source);
    const renderer = this.assets.effectVisuals[event.effect]?.renderer;
    // Targeted effects can update facing, but never restart a casting action.
    if (
      source &&
      source.deadAt === undefined &&
      ((renderer !== "projectile" && renderer !== "lightning") ||
        event.payload.from === event.source)
    ) {
      const targetId = event.payload.to;
      const target =
        typeof targetId === "number" ? this.views.get(targetId) : undefined;
      if (target && target.position !== source.position) {
        source.facing = Math.sign(target.position - source.position);
      }
    }
  }

  reset(): void {
    for (const view of this.views.values())
      view.root.destroy({ children: true });
    this.views.clear();
  }
  update(log: BattleLog, progress: number, animationTime: number): void {
    for (const unit of log.units) {
      let view = this.views.get(unit.id);
      if (!view) {
        view = this.createUnit(unit, animationTime);
        this.views.set(unit.id, view);
      }
      view.from += (view.position - view.from) * progress;
      const displacement = unit.position - view.position;
      const walking = Math.abs(displacement) > 0.001;
      if (walking) view.facing = Math.sign(displacement);
      if (walking && !view.walking) view.walkAt = animationTime;
      if (walking) view.walkUntil = animationTime + 200;
      view.walking = walking;
      view.position = unit.position;
      if (unit.hp <= 0 && view.deadAt === undefined)
        view.deadAt = animationTime;
      view.label.text = unit.name;
      view.health.clear().rect(-19, -40, 38, 4).fill(0x25324b);
      const ratio = Math.max(
        0,
        Math.min(1, unit.hp / (unit.status.attributes.maxHp || 1)),
      );
      if (ratio > 0)
        view.health
          .rect(-19, -40, 38 * ratio, 4)
          .fill(ratio < 0.3 ? 0xff718a : 0x7ee2ba);
    }
    const ids = new Set(log.units.map((unit) => unit.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id) && view.deadAt === undefined)
        view.deadAt = animationTime;
    }
  }
  draw(
    progress: number,
    x: (position: number) => number,
    height: number,
    unitScale: number,
    time: number,
    playing: boolean,
  ): void {
    for (const [id, view] of this.views) {
      const position = view.from + (view.position - view.from) * progress;
      view.root.position.set(
        Math.round(x(position)),
        Math.round(unitY(id, view.kind, height)),
      );
      this.drawUnit(view, id, unitScale, time, playing);
    }
  }
  private createUnit(unit: Unit, animationTime: number): View {
    const root = new Container();
    const poses =
      this.assets.characters[unit.kind] ?? this.assets.characters.Goblin!;
    const body = new Sprite({
      texture: poses.animations.idle.frames[0]!,
      roundPixels: true,
    });
    body.anchor.set(0.5, 1);
    body.scale.set(poses.scale);
    body.y = 20;
    const shadow = new Graphics()
      .ellipse(0, 20, 20, 5)
      .fill({ color: 0x000000, alpha: 0.25 });
    const health = new Graphics();
    const label = createText(unit.name, 10, 0xb3c2dc);
    label.anchor.set(0.5);
    label.y = -49;
    root.addChild(shadow, body, health, label);
    if (unit.kind !== "Player") {
      root.eventMode = "static";
      root.cursor = "pointer";
      root.hitArea = new Rectangle(-28, -58, 56, 84);
      root.on("pointertap", (event) => {
        if (event.button !== 0) return;
        this.onInspect(unit.kind, event);
      });
    }
    (unit.kind === "Player" ? this.playerLayer : this.actors).addChild(root);
    return {
      root,
      body,
      poses,
      health,
      label,
      shadow,
      from: unit.position,
      position: unit.position,
      kind: unit.kind,
      hitAt: -Infinity,
      animation: "idle",
      facing: unit.kind === "Player" ? 1 : -1,
      walking: false,
      walkAt: animationTime,
      walkUntil: animationTime,
    };
  }

  private drawUnit(
    view: View,
    id: number,
    unitScale: number,
    time: number,
    playing: boolean,
  ): void {
    view.root.scale.set(unitScale);
    const clips = view.poses.animations;
    let animation: CharacterAnimation = "idle";
    let elapsed = time;
    if (view.deadAt !== undefined) {
      animation = "death";
      elapsed = time - view.deadAt;
    } else if (time - view.hitAt < clips.hit.durationMs) {
      animation = "hit";
      elapsed = time - view.hitAt;
    } else if (
      view.action &&
      time - view.action.startedAt < clips[view.action.kind].durationMs
    ) {
      animation = view.action.kind;
      elapsed = time - view.action.startedAt;
    } else if (view.walking && (playing || time < view.walkUntil)) {
      animation = "walk";
      elapsed = time - view.walkAt;
    }
    const clip = clips[animation];
    const phase = Math.max(0, elapsed) / clip.durationMs;
    const frame = Math.min(
      clip.frames.length - 1,
      Math.floor(
        (clip.loop ? phase % 1 : Math.min(phase, 1)) * clip.frames.length,
      ),
    );
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
