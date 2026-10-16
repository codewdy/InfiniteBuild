import {
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
} from "pixi.js";
import type { BattlefieldAssets } from "@infinite-build/assets";
import type { BattleLog } from "@infinite-build/core";
import type { BattlefieldState } from "../types.js";
import { createText } from "./text.js";
import {
  REFERENCE_HEIGHT,
  BATTLE_PROGRESS_HEIGHT,
  BATTLE_PROGRESS_BOTTOM,
} from "./layout.js";
export class BattleProgress extends Container {
  private readonly battleProgressBar = new Graphics();
  private readonly battleProgressFrame: NineSliceSprite;
  private readonly battleProgressText = createText("", 9, 0xffffff);
  private readonly playbackButton = new Container();
  private readonly playbackButtonIcon = new Sprite({ roundPixels: true });
  private readonly playbackButtonText = createText("继续", 10, 0xe7f8f4);

  constructor(
    private readonly assets: BattlefieldAssets,
    private readonly canToggle: () => boolean,
    private readonly onTogglePlaying?: () => void,
  ) {
    super();
    this.battleProgressFrame = new NineSliceSprite({
      texture: assets.progressFrame,
      leftWidth: 85,
      rightWidth: 85,
      topHeight: 32,
      bottomHeight: 32,
    });
    this.visible = false;
    this.eventMode = "passive";
    this.battleProgressText.anchor.set(0.5);
    this.battleProgressText.style.fontWeight = "bold";
    this.battleProgressText.style.stroke = { color: 0x0d1424, width: 2 };
    this.battleProgressBar.eventMode =
      this.battleProgressFrame.eventMode =
      this.battleProgressText.eventMode =
        "none";
    this.playbackButtonIcon.anchor.set(0.5);
    this.playbackButtonIcon.eventMode = "none";
    this.playbackButtonText.anchor.set(1, 1);
    this.playbackButtonText.visible = false;
    this.playbackButtonText.eventMode = "none";
    this.playbackButtonText.style.stroke = { color: 0x0d1424, width: 3 };
    this.playbackButtonText.style.fontWeight = "bold";
    this.playbackButton.addChild(
      this.playbackButtonIcon,
      this.playbackButtonText,
    );
    this.playbackButton.on("pointertap", (event) => {
      if (event.button !== 0 || !this.canToggle()) return;
      event.stopPropagation();
      this.onTogglePlaying?.();
    });
    this.playbackButton.on("pointerover", () => {
      this.playbackButtonIcon.tint = 0xbcece5;
      this.playbackButtonText.visible = true;
    });
    this.playbackButton.on("pointerout", () => {
      this.playbackButtonIcon.tint = 0xffffff;
      this.playbackButtonText.visible = false;
    });
    this.addChild(
      this.battleProgressBar,
      this.battleProgressFrame,
      this.battleProgressText,
      this.playbackButton,
    );
  }
  reset(): void {
    this.visible = false;
    this.playbackButtonText.visible = false;
  }
  draw(
    width: number,
    height: number,
    log: BattleLog,
    options: Omit<BattlefieldState, "log">,
    transitioning: boolean,
  ): void {
    const { defeated, total } = log.progress;
    const ratio = total > 0 ? Math.max(0, Math.min(1, defeated / total)) : 1;
    const scale = Math.min(width, height) / REFERENCE_HEIGHT;
    const padding = 8 * scale;
    const buttonWidth = BATTLE_PROGRESS_HEIGHT * scale * 0.85;
    const buttonGap = 6 * scale;
    const barWidth = width - padding * 2 - buttonGap - buttonWidth;
    const barHeight = BATTLE_PROGRESS_HEIGHT * scale;
    const frameScale = barHeight / 124;
    const insetX = 74 * frameScale;
    const insetY = 32 * frameScale;
    const innerWidth = barWidth - insetX * 2;
    const innerHeight = barHeight - insetY * 2;
    this.visible = true;
    this.position.set(
      padding,
      height - BATTLE_PROGRESS_BOTTOM * scale - barHeight,
    );
    // Keep the carved end caps proportional while stretching only the center rails.
    this.battleProgressFrame.scale.set(frameScale);
    this.battleProgressFrame.width = barWidth / frameScale;
    this.battleProgressFrame.height = 124;
    this.battleProgressBar
      .clear()
      .rect(insetX, insetY, innerWidth, innerHeight)
      .fill({ color: 0x0d2027, alpha: 0.92 });
    if (ratio > 0) {
      this.battleProgressBar
        .rect(insetX, insetY, innerWidth * ratio, innerHeight)
        .fill(0x329b94)
        .rect(insetX, insetY, innerWidth * ratio, innerHeight * 0.25)
        .fill(0x7eddd1);
    }
    this.battleProgressText.text = [
      options.level?.join("-"),
      options.mapName,
      `${defeated}/${total}`,
    ]
      .filter(Boolean)
      .join(" ");
    this.battleProgressText.scale.set(scale);
    const labelWidth = Math.max(1, barWidth - insetX * 2 - 8 * scale);
    if (this.battleProgressText.width > labelWidth) {
      this.battleProgressText.scale.set(
        (scale * labelWidth) / this.battleProgressText.width,
      );
    }
    this.battleProgressText.position.set(barWidth / 2, barHeight / 2);
    const enabled =
      log.status === "Running" && !!this.onTogglePlaying && !transitioning;
    this.playbackButton.position.set(
      barWidth + buttonGap,
      (barHeight - buttonWidth) / 2,
    );
    this.playbackButton.eventMode = enabled ? "static" : "none";
    this.playbackButton.cursor = enabled ? "pointer" : "default";
    this.playbackButton.alpha = enabled ? 1 : 0.5;
    this.playbackButton.hitArea = new Rectangle(0, 0, buttonWidth, buttonWidth);
    this.playbackButtonIcon.texture = options.playing
      ? this.assets.playbackIcons.pause
      : this.assets.playbackIcons.resume;
    this.playbackButtonIcon.width = this.playbackButtonIcon.height =
      buttonWidth;
    this.playbackButtonIcon.position.set(buttonWidth / 2, buttonWidth / 2);
    this.playbackButtonText.text = options.playing ? "暂停" : "继续";
    this.playbackButton.label = this.playbackButtonText.text;
    if (!enabled) this.playbackButtonText.visible = false;
    this.playbackButtonText.scale.set(scale);
    this.playbackButtonText.position.set(buttonWidth, -3 * scale);
  }
}
