import { Container, Sprite, Text } from "pixi.js";
import type { Texture } from "pixi.js";
import type { SettlementAssets } from "./battlefield-assets.js";

export type BattlefieldResult = {
  outcome: "Victory" | "Defeat";
  xpGain: number;
  rewards: readonly {
    kind: "skill" | "passive" | "support-skill" | "support-passive" | "pending";
    count: number;
  }[];
};

function rewardText(value: string, fill: number): Text {
  return new Text({
    text: value,
    resolution: 2,
    style: {
      fontFamily: "monospace", fontSize: 16, fontWeight: "bold", fill,
      stroke: { color: 0x101827, width: 3 },
      dropShadow: { color: 0x080d18, alpha: 0.7, blur: 2, distance: 2 },
    },
  });
}

/** Transparent two-line settlement using shared atlas textures. */
export class BattleResultOverlay extends Container {
  private readonly card = new Container();
  private readonly emblem = new Sprite();
  private readonly title = new Text({
    text: "", resolution: 2,
    style: {
      fontFamily: "system-ui, sans-serif", fontSize: 48, fontWeight: "900", fill: 0xffdf9a,
      letterSpacing: 5,
      stroke: { color: 0x202337, width: 5 },
      dropShadow: { color: 0x080d18, alpha: 0.85, blur: 4, distance: 3 },
    },
  });
  private readonly rewardRow = new Container();
  private shownAt = 0;
  private expiresAt = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private cardY = 0;
  private readonly cells: { root: Container; icon: Sprite; label: Text }[] = [];

  constructor(private readonly assets: SettlementAssets) {
    super();
    this.visible = false;
    this.eventMode = "none";
    this.emblem.anchor.set(0.5);
    this.title.anchor.set(0, 0.5);
    this.card.addChild(this.emblem, this.title, this.rewardRow);
    this.addChild(this.card);
  }

  show(result: BattlefieldResult, durationMs: number = 1000): void {
    const victory = result.outcome === "Victory";
    this.title.text = victory ? "胜利" : "失败";
    this.title.style.fill = victory ? 0xffdf9a : 0xffa6ac;
    this.emblem.texture = this.assets.emblems[result.outcome];
    // Sprites are disposable; atlas textures stay shared across all settlements.
    for (const child of this.rewardRow.removeChildren()) child.destroy({ children: true });
    this.cells.length = 0;
    for (const reward of result.rewards) {
      this.addReward(this.assets.rewards[reward.kind], `×${reward.count}`, 0xf3f1e9);
    }
    this.addReward(this.assets.rewards.xp, `+${result.xpGain} XP`, 0xc4f0df);
    this.shownAt = performance.now();
    this.expiresAt = this.shownAt + durationMs;
    this.viewportWidth = this.viewportHeight = 0;
    this.visible = true;
    this.alpha = 0;
  }

  private addReward(texture: Texture, value: string, color: number): void {
    const root = new Container();
    const icon = new Sprite({ texture, roundPixels: true });
    const label = rewardText(value, color);
    icon.anchor.set(0.5);
    label.anchor.set(0, 0.5);
    root.addChild(icon, label);
    this.rewardRow.addChild(root);
    this.cells.push({ root, icon, label });
  }

  hide(): void {
    this.visible = false;
    this.expiresAt = 0;
  }

  private layout(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    const w = Math.max(1, Math.min(480, width - 24));
    const h = 140;
    const compact = w < 360;
    this.title.style.fontSize = compact ? 40 : 48;
    const badgeSize = compact ? 44 : 52;
    const iconSize = compact ? 32 : 36;
    const headerWidth = badgeSize + 14 + this.title.width;
    this.emblem.width = this.emblem.height = badgeSize;
    this.emblem.position.set(Math.round((w - headerWidth + badgeSize) / 2), 40);
    this.title.position.set(this.emblem.x + badgeSize / 2 + 14, 40);
    let rowWidth = 0;
    const gap = compact ? 12 : 18;
    for (const cell of this.cells) {
      cell.icon.width = cell.icon.height = iconSize;
      cell.icon.position.set(iconSize / 2, 0);
      cell.label.style.fontSize = compact ? 14 : 16;
      cell.label.position.set(iconSize + 6, 0);
      cell.root.x = rowWidth;
      rowWidth += iconSize + 6 + cell.label.width + gap;
    }
    rowWidth -= gap;
    const rowScale = Math.min(1, Math.max(1, w - 16) / rowWidth);
    this.rewardRow.scale.set(rowScale);
    this.rewardRow.position.set(Math.round((w - rowWidth * rowScale) / 2), 106);
    const scale = Math.min(1, Math.max(1, height - 24) / h);
    this.card.scale.set(scale);
    this.cardY = Math.round((height - h * scale) / 2);
    this.card.position.set(Math.round((width - w * scale) / 2), this.cardY);
  }

  update(now: number, width: number, height: number): void {
    if (!this.visible) return;
    if (now >= this.expiresAt) {
      this.hide();
      return;
    }
    const age = now - this.shownAt;
    const remaining = this.expiresAt - now;
    this.alpha = Math.min(1, age / 100, remaining / 180);
    if (width !== this.viewportWidth || height !== this.viewportHeight) this.layout(width, height);
    const entrance = 1 - Math.min(1, age / 140);
    this.card.y = this.cardY + Math.round(6 * entrance * entrance);
  }
}
