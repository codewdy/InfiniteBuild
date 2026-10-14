import { Container, Graphics, Text } from "pixi.js";
import type { Rectangle } from "pixi.js";

/** Floating hint with a pulsing outline around the next required action. */
export class LevelTutorialView extends Container {
  private readonly highlight = new Graphics();
  private readonly card = new Container();
  private readonly background = new Graphics();
  private readonly title = new Text({ text: "", resolution: 2,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 17, fontWeight: "bold", fill: 0xffe5a6 } });
  private readonly description = new Text({ text: "", resolution: 2,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 21, fill: 0xd4e2de, wordWrap: true } });

  constructor() {
    super();
    this.visible = false;
    this.eventMode = "none";
    this.card.addChild(this.background, this.title, this.description);
    this.addChild(this.highlight, this.card);
    this.onRender = () => { this.highlight.alpha = 0.7 + Math.sin(performance.now() / 250) * 0.25; };
  }

  show(target: Rectangle, width: number, height: number, selecting: boolean): void {
    this.visible = true;
    this.highlight.clear().roundRect(target.x - 3, target.y - 3, target.width + 6, target.height + 6, 8)
      .stroke({ color: 0xffd477, width: 3 });
    const cardWidth = Math.min(280, width - 24);
    this.title.text = selecting ? "挑战下一关" : "关卡已解锁";
    this.description.text = selecting ? "点击高亮的 1-2，\n开始新的挑战。" : "你已通关 1-1！\n点击「关卡」，前往 1-2。";
    this.description.style.wordWrapWidth = cardWidth - 32;
    this.title.position.set(16, 13);
    this.description.position.set(16, 41);
    const cardHeight = this.description.height + 55;
    const right = target.x + target.width + 16;
    const beside = right + cardWidth <= width - 12;
    const x = beside ? right : target.x + (target.width - cardWidth) / 2;
    const y = beside ? target.y : target.y + target.height + cardHeight + 16 <= height - 12
      ? target.y + target.height + 16 : target.y - cardHeight - 16;
    this.card.position.set(Math.max(12, Math.min(width - cardWidth - 12, x)),
      Math.max(12, Math.min(height - cardHeight - 12, y)));
    this.background.clear().roundRect(3, 5, cardWidth, cardHeight, 12).fill({ color: 0, alpha: 0.3 })
      .roundRect(0, 0, cardWidth, cardHeight, 12).fill({ color: 0x10252d, alpha: 0.97 })
      .stroke({ color: 0xffd477, width: 1, alpha: 0.8 });
  }
}
