import { Container, Graphics, Text } from "pixi.js";

export type BattlefieldResult = {
  outcome: "Victory" | "Defeat";
  xpGain: number;
  rewards: readonly {
    kind: "skill" | "passive" | "support-skill" | "support-passive" | "pending";
    count: number;
  }[];
};

const trophy = [
  "0000000000000000", "0001111111111000", "0111222222221110", "0121222222221210",
  "0121222222221210", "0121222222221210", "0011222222221100", "0001122222211000",
  "0000112222110000", "0000011221100000", "0000001221000000", "0000001221000000",
  "0000111221110000", "0000122222210000", "0001111111111000", "0000000000000000",
];
const skull = [
  "0000011111100000", "0001122222211000", "0012222222222100", "0122222222222210",
  "0122222222222210", "0122112221122210", "0122112221122210", "0122222222222210",
  "0012222112222100", "0001222112221000", "0001122222211000", "0000121212210000",
  "0000121212210000", "0000011111100000", "0000000000000000", "0000000000000000",
];

const flame = [
  "0000000100000000", "0000001100000000", "0000011200000000", "0000112200000000",
  "0000122100100000", "0001222100120000", "0012222111221000", "0012222222221000",
  "0122222332222100", "0122223333222100", "0122233333322100", "0122233333322100",
  "0012223333221000", "0011222222211000", "0001112221110000", "0000011111000000",
];
const heart = [
  "0000000000000000", "0001110001110000", "0012221012221000", "0122222122222100",
  "0123322222232100", "0123322222222100", "0122222222222100", "0012222222221000",
  "0001222222210000", "0000122222100000", "0000012221000000", "0000001210000000",
  "0000000100000000", "0000000000000000", "0000000000000000", "0000000000000000",
];
const arrow = [
  "0000000000000000", "0000000010000000", "0000000011000000", "0000000012100000",
  "0000000012210000", "0011111112221000", "0012222222222100", "0012333333322210",
  "0012222222222100", "0011111112221000", "0000000012210000", "0000000012100000",
  "0000000011000000", "0000000010000000", "0000000000000000", "0000000000000000",
];
const chest = [
  "0000000000000000", "0000111111110000", "0001222222221000", "0012222222222100",
  "0012111111112100", "0012222332222100", "0011111331111100", "0012222332222100",
  "0012222222222100", "0012222222222100", "0012222222222100", "0011111111111100",
  "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000",
];
const crystal = [
  "0000000100000000", "0000001210000000", "0000012321000000", "0000123332100000",
  "0001233333210000", "0012333333321000", "0122333333322100", "1222233333222210",
  "0122223332222100", "0012222322221000", "0001222222210000", "0000122222100000",
  "0000012221000000", "0000001210000000", "0000000100000000", "0000000000000000",
];

function text(size: number, fill: number): Text {
  return new Text({
    text: "", resolution: 1, textureStyle: { scaleMode: "nearest" },
    style: { fontFamily: "monospace", fontSize: size, fill, stroke: { color: 0x101827, width: 2 } },
  });
}

function icon(pattern: readonly string[], colors: readonly number[]): Graphics {
  const graphic = new Graphics();
  for (const [y, row] of pattern.entries()) {
    for (const [x, value] of [...row].entries()) {
      if (value !== "0") graphic.rect(x, y, 1, 1).fill(colors[Number(value) - 1]!);
    }
  }
  return graphic;
}

/** Two-line pixel-art settlement, timed independently of battle frames. */
export class BattleResultOverlay extends Container {
  private readonly card = new Container();
  private readonly emblem = new Container();
  private readonly title = text(44, 0xefc471);
  private readonly rewardRow = new Container();
  private shownAt = 0;
  private expiresAt = 0;
  private color = 0xefc471;
  private shade = 0x735332;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private cardY = 0;
  private readonly cells: { root: Container; icon: Graphics; label: Text }[] = [];

  constructor() {
    super();
    this.visible = false;
    this.eventMode = "none";
    this.title.style.fontWeight = "bold";
    this.title.style.stroke = { color: 0x101827, width: 4 };
    this.card.addChild(this.emblem, this.title, this.rewardRow);
    this.addChild(this.card);
  }

  show(result: BattlefieldResult, durationMs: number = 1000): void {
    const victory = result.outcome === "Victory";
    this.color = victory ? 0xefc471 : 0xf28b87;
    this.shade = victory ? 0x735332 : 0x713b4a;
    this.title.text = victory ? "胜利" : "失败";
    this.title.style.fill = this.color;
    for (const child of this.emblem.removeChildren()) child.destroy();
    this.emblem.addChild(icon(victory ? trophy : skull, [this.shade, this.color]));
    for (const child of this.rewardRow.removeChildren()) child.destroy({ children: true });
    this.cells.length = 0;
    const palettes = {
      skill: { pattern: flame, colors: [0x9d492e, 0xff9959, 0xffe5a1] },
      passive: { pattern: heart, colors: [0x385e58, 0x7dd8ae, 0xc9f3cd] },
      "support-skill": { pattern: arrow, colors: [0x3c568f, 0x88bcff, 0xe2efff] },
      "support-passive": { pattern: arrow, colors: [0x694a90, 0xb69aef, 0xefddff] },
      pending: { pattern: chest, colors: [0x805938, 0xc39056, 0xffd97d] },
    };
    for (const reward of result.rewards) {
      const palette = palettes[reward.kind];
      this.addReward(icon(palette.pattern, palette.colors), `×${reward.count}`, 0xe6ecfa);
    }
    this.addReward(icon(crystal, [0x355c85, 0x81cbdd, 0xd6f6ed]), `+${result.xpGain} XP`, 0xc9eadf);
    this.shownAt = performance.now();
    this.expiresAt = this.shownAt + durationMs;
    this.viewportWidth = this.viewportHeight = 0;
    this.visible = true;
    this.alpha = 0;
  }

  private addReward(graphic: Graphics, value: string, color: number): void {
    const root = new Container();
    const label = text(14, color);
    label.text = value;
    root.addChild(graphic, label);
    this.rewardRow.addChild(root);
    this.cells.push({ root, icon: graphic, label });
  }

  hide(): void {
    this.visible = false;
    this.expiresAt = 0;
  }

  private layout(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    const w = Math.max(4, Math.floor(Math.min(420, width - 24) / 4) * 4);
    const h = 120;
    this.title.style.fontSize = w >= 360 ? 44 : 36;
    const pixel = w >= 360 ? 2 : 1;
    const iconSize = 16 * pixel;
    this.emblem.scale.set(2);
    this.emblem.position.set(Math.round((w - 32 - 12 - this.title.width) / 2), 18);
    this.title.position.set(this.emblem.x + 44, Math.round(34 - this.title.height / 2));
    let rowWidth = 0;
    for (const cell of this.cells) {
      cell.icon.scale.set(pixel);
      cell.label.style.fontSize = w >= 360 ? 14 : 12;
      cell.label.position.set(iconSize + 4, Math.round((iconSize - cell.label.height) / 2));
      cell.root.x = rowWidth;
      rowWidth += iconSize + 4 + cell.label.width + 12;
    }
    rowWidth -= 12;
    const rowScale = Math.min(1, Math.max(1, w - 32) / rowWidth);
    this.rewardRow.scale.set(rowScale);
    this.rewardRow.position.set(Math.round((w - rowWidth * rowScale) / 2), Math.round(96 - iconSize * rowScale / 2));
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
    this.alpha = Math.ceil(Math.min(1, age / 120, remaining / 300) * 4) / 4;
    if (width !== this.viewportWidth || height !== this.viewportHeight) this.layout(width, height);
    this.card.y = this.cardY + Math.max(0, 3 - Math.floor(age / 40)) * 2;
  }
}
