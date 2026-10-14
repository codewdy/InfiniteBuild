import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import type { Texture } from "pixi.js";

/** Full-canvas title scene, mounted above the game until the player starts. */
export class StartScreenView extends Container {
  private readonly background: Sprite;
  private readonly shade = new Graphics();
  private readonly card = new Container();
  private readonly button = new Container();
  private readonly buttonBackground = new Graphics();
  private onStart?: () => void;

  constructor(texture: Texture) {
    super();
    this.visible = false;
    this.eventMode = "static";
    this.on("pointertap", (event) => event.stopPropagation());
    this.background = new Sprite(texture);
    this.background.anchor.set(0.5);
    this.background.eventMode = "none";
    this.shade.eventMode = "none";
    const label = (value: string, y: number, size: number, color: number) => {
      const text = new Text({
        text: value,
        resolution: 2,
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: size,
          fill: color,
          align: "center",
        },
      });
      text.anchor.set(0.5);
      text.position.set(0, y);
      text.eventMode = "none";
      return text;
    };
    const frame = new Graphics()
      .roundRect(-220, -235, 440, 470, 16)
      .fill({ color: 0x0d2028, alpha: 0.94 })
      .stroke({ color: 0x91bca5, alpha: 0.4, width: 1 });
    this.card.addChild(
      frame,
      label("INFINITE BUILD", -190, 14, 0xb6cbb8),
      label("✦", -120, 64, 0xe6cc89),
      label("无限构筑", -46, 46, 0xf0e6ca),
      label(
        "组合石板，唤醒技能。\n在一次次挑战中，找到属于你的构筑。",
        28,
        16,
        0xb6c8c8,
      ),
    );
    this.button.position.set(0, 112);
    this.button.eventMode = "static";
    this.button.cursor = "pointer";
    this.button.hitArea = new Rectangle(-140, -28, 280, 56);
    this.paintButton(0xe6cc89);
    this.button.addChild(
      this.buttonBackground,
      label("开始游戏", 0, 20, 0x18282b),
    );
    this.button.on("pointerover", () => this.paintButton(0xf4dda4));
    this.button.on("pointerout", () => this.paintButton(0xe6cc89));
    this.button.on("pointertap", (event) => {
      event.stopPropagation();
      if (event.button === 0) this.start();
    });
    this.card.addChild(
      this.button,
      label("点击开始，或按 Enter", 176, 14, 0xa6bdb8),
    );
    this.addChild(this.background, this.shade, this.card);
  }

  private paintButton(color: number): void {
    this.buttonBackground.clear().roundRect(-140, -28, 280, 56, 8).fill(color);
  }

  show(onStart: () => void): void {
    this.onStart = onStart;
    this.paintButton(0xe6cc89);
    this.visible = true;
  }

  start(): void {
    if (!this.visible) return;
    this.visible = false;
    const callback = this.onStart;
    this.onStart = undefined;
    callback?.();
  }

  layout(width: number, height: number): void {
    this.hitArea = new Rectangle(0, 0, width, height);
    const scale = Math.max(
      width / this.background.texture.width,
      height / this.background.texture.height,
    );
    this.background.scale.set(scale);
    this.background.position.set(width / 2, height / 2);
    this.shade
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: 0x09151b, alpha: 0.5 });
    this.card.scale.set(
      Math.max(0.001, Math.min(1, (width - 32) / 440, (height - 32) / 470)),
    );
    this.card.position.set(width / 2, height / 2);
  }
}
