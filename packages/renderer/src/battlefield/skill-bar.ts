import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type Renderer,
  type Texture,
} from "pixi.js";
import type { BattlefieldAssets } from "@infinite-build/assets";
import type { BattleLog } from "@infinite-build/core";
import type { BattlefieldOptions } from "../types.js";
import {
  REFERENCE_HEIGHT,
  SKILL_SIZE_FACTOR,
  BATTLE_PROGRESS_BOTTOM,
  BATTLE_PROGRESS_HEIGHT,
  BATTLE_PROGRESS_GAP,
} from "./layout.js";
export class SkillBar extends Container {
  private readonly skillBarTextures = new Map<string, Texture>();
  private readonly skillBars: {
    progress: number;
    castRate: number;
    root: Container;
    icon: Container;
    shade: Container;
    mask: Graphics;
  }[] = [];

  constructor(
    private readonly renderer: Renderer,
    private readonly assets: BattlefieldAssets,
    private readonly config: BattlefieldOptions,
  ) {
    super();
  }
  dispose(): void {
    this.reset();
    for (const texture of this.skillBarTextures.values()) texture.destroy(true);
    this.skillBarTextures.clear();
  }
  reset(): void {
    for (const child of this.removeChildren())
      child.destroy({ children: true });
    this.skillBars.length = 0;
  }

  update(log: BattleLog): void {
    this.reset();
    for (const event of log.events) {
      if (event.kind !== "PlayerSkillProgress") continue;
      const progress = Math.max(0, Math.min(1, event.progress));
      const root = new Container();
      let texture = this.skillBarTextures.get(event.skill);
      if (!texture) {
        const artwork = this.assets.createSkillIcon(event.skill);
        texture = this.renderer.generateTexture({
          target: artwork,
          frame: new Rectangle(-50, -50, 100, 100),
          resolution: 2,
          clearColor: [0, 0, 0, 0],
          textureSourceOptions: { scaleMode: "nearest" },
        });
        artwork.destroy({ children: true });
        this.skillBarTextures.set(event.skill, texture);
      }
      // Share the composed texture so the shade follows its exact alpha silhouette.
      const icon = new Sprite({ texture, roundPixels: true });
      const shade = new Sprite({
        texture,
        tint: 0x000000,
        alpha: 0.68,
        roundPixels: true,
      });
      icon.anchor.set(0.5);
      shade.anchor.set(0.5);
      const mask = new Graphics();
      shade.mask = mask;
      const name =
        this.config.skillDefinitions?.[event.skill]?.name ?? "未知技能";
      root.label = `${name} ${Math.round(progress * 100)}% (${event.uuid})`;
      root.addChild(icon, shade, mask);
      this.addChild(root);
      this.skillBars.push({
        progress,
        castRate: event.castRate,
        root,
        icon,
        shade,
        mask,
      });
    }
  }

  draw(width: number, height: number, frameProgress: number): void {
    const count = this.skillBars.length;
    if (count === 0) return;
    // Scale icons and spacing together; overflow wraps into rows above.
    const scale =
      (Math.min(width, height) / REFERENCE_HEIGHT) * SKILL_SIZE_FACTOR;
    const padding = 12 * scale;
    const gap = 8 * scale;
    const itemWidth = 44 * scale;
    const bottomOffset =
      (BATTLE_PROGRESS_BOTTOM + BATTLE_PROGRESS_HEIGHT + BATTLE_PROGRESS_GAP) *
      (Math.min(width, height) / REFERENCE_HEIGHT);
    const columns = Math.max(
      1,
      Math.floor((width - padding * 2 + gap) / (itemWidth + gap)),
    );
    for (const [index, bar] of this.skillBars.entries()) {
      // The log is the end of this frame. Sweep forward by castRate to reach it.
      const accumulated = bar.progress - bar.castRate * (1 - frameProgress);
      const progress =
        frameProgress >= 1 || bar.castRate === 0
          ? bar.progress
          : ((accumulated % 1) + 1) % 1;
      const x = padding + (index % columns) * (itemWidth + gap);
      const y =
        height -
        bottomOffset -
        itemWidth -
        Math.floor(index / columns) * (itemWidth + gap);
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
        bar.mask
          .moveTo(0, 0)
          .arc(
            0,
            0,
            radius,
            -Math.PI / 2 + Math.PI * 2 * progress,
            Math.PI * 1.5,
          )
          .closePath()
          .fill(0xffffff);
      }
    }
  }
}
