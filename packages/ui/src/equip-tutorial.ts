import { Container, Graphics, Point, Text } from "pixi.js";

/** A non-interactive coachmark and a looping demonstration over the real slots. */
export class EquipTutorialView extends Container {
  private readonly path = new Graphics();
  private readonly sourceFrame = new Graphics();
  private readonly targetFrame = new Graphics();
  private readonly card = new Container();
  private readonly cardBackground = new Graphics();
  private readonly title = new Text({ text: "装备你的第一个技能", resolution: 2,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 17, fontWeight: "bold", fill: 0xffe5a6 } });
  private readonly description = new Text({ text: "", resolution: 2,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 21, fill: 0xd4e2de, wordWrap: true } });
  private readonly demonstration = new Container();
  private readonly stone = new Container();
  private readonly press = new Graphics().circle(0, 0, 15).stroke({ color: 0xffd477, width: 2 });
  private readonly pointer = new Graphics()
    .poly([0, 0, 0, 24, 6, 18, 12, 30, 17, 27, 11, 16, 21, 16])
    .fill(0xfff5da).stroke({ color: 0x16282e, width: 2 });
  private source = new Point();
  private target = new Point();
  private startedAt = 0;

  constructor() {
    super();
    this.eventMode = "none";
    this.visible = false;
    this.card.addChild(this.cardBackground, this.title, this.description);
    this.demonstration.addChild(this.stone, this.press, this.pointer);
    this.addChild(this.path, this.sourceFrame, this.targetFrame, this.card, this.demonstration);
    this.onRender = () => this.animate(performance.now());
  }

  setStone(artwork: Container | undefined): void {
    for (const child of this.stone.removeChildren()) child.destroy({ children: true });
    if (artwork) this.stone.addChild(artwork);
  }

  show(source: Point, target: Point, slotSize: number, width: number, height: number, name: string): void {
    this.source = source;
    this.target = target;
    this.visible = true;
    this.startedAt = performance.now();
    this.stone.scale.set(slotSize / 80);
    this.pointer.scale.set(Math.max(0.65, Math.min(1, slotSize / 60)));
    this.press.position.set(slotSize * 0.2, slotSize * 0.2);
    this.pointer.position.copyFrom(this.press.position);
    for (const [frame, point, color] of [
      [this.sourceFrame, source, 0xffd477], [this.targetFrame, target, 0x82e6ce],
    ] as const) {
      frame.clear().roundRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 6)
        .stroke({ color, width: 2 });
      frame.position.copyFrom(point);
    }
    this.path.clear().moveTo(source.x, source.y).lineTo(target.x, target.y)
      .stroke({ color: 0xffd477, width: 2, alpha: 0.25 });
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    this.path.moveTo(target.x - Math.cos(angle - 0.5) * 12, target.y - Math.sin(angle - 0.5) * 12)
      .lineTo(target.x, target.y)
      .lineTo(target.x - Math.cos(angle + 0.5) * 12, target.y - Math.sin(angle + 0.5) * 12)
      .stroke({ color: 0xffd477, width: 2, alpha: 0.65 });
    const cardWidth = Math.min(280, width - 24);
    this.description.style.wordWrapWidth = cardWidth - 32;
    this.description.text = `按住背包中的${name}石板，\n拖到发光的空槽后松开。`;
    this.title.position.set(16, 13);
    this.description.position.set(16, 41);
    const cardHeight = 55 + this.description.height;
    const x = Math.max(12, Math.min(width - cardWidth - 12, source.x - cardWidth / 2));
    // Put the floating card beside the source without covering either endpoint.
    const above = source.y - slotSize / 2 - cardHeight - 18;
    const below = source.y + slotSize / 2 + 18;
    const overlapsTarget = (y: number) => target.x + slotSize / 2 > x && target.x - slotSize / 2 < x + cardWidth &&
      target.y + slotSize / 2 > y && target.y - slotSize / 2 < y + cardHeight;
    const y = above >= 12 && !overlapsTarget(above) ? above : below;
    this.card.position.set(x, Math.max(12, Math.min(height - cardHeight - 12, y)));
    this.cardBackground.clear().roundRect(3, 5, cardWidth, cardHeight, 12).fill({ color: 0x000000, alpha: 0.3 })
      .roundRect(0, 0, cardWidth, cardHeight, 12).fill({ color: 0x10252d, alpha: 0.97 })
      .stroke({ color: 0xffd477, width: 1, alpha: 0.8 });
    this.animate(this.startedAt);
  }

  private animate(now: number): void {
    const phase = ((now - this.startedAt) % 2800) / 2800;
    const progress = Math.max(0, Math.min(1, (phase - 0.18) / 0.52));
    const eased = progress * progress * (3 - 2 * progress);
    this.demonstration.position.set(
      this.source.x + (this.target.x - this.source.x) * eased,
      this.source.y + (this.target.y - this.source.y) * eased,
    );
    this.demonstration.alpha = phase < 0.85 ? 0.8 : 0.8 * (1 - phase) / 0.15;
    this.stone.visible = phase >= 0.18;
    this.press.visible = phase < 0.25 || (phase >= 0.7 && phase < 0.85);
    this.press.scale.set(0.75 + (phase % 0.18) * 3);
    this.sourceFrame.alpha = 0.65 + Math.sin(phase * Math.PI * 2) * 0.25;
    this.targetFrame.alpha = progress === 1 ? 1 : 0.65;
  }
}
