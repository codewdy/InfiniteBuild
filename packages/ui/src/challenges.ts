import { levelTutorialPending } from "./tutorial.js";
import { Container, Graphics, Rectangle, Text } from "pixi.js";
import type { GameData, MapLevel, PlayerState } from "@infinite-build/core";

/** Single-column challenge list; selecting an unlocked level starts it immediately. */
export class ChallengesView extends Container {
  private state?: PlayerState;
  tutorialTarget?: Container;
  private key = "";
  private viewWidth = 1;
  private viewHeight = 1;
  private page = 0;

  constructor(private readonly data: GameData, private readonly onSelect?: (level: MapLevel) => void, private readonly onAutoAdvanceChange?: (enabled: boolean) => void) {
    super();
  }

  update(state: PlayerState): void {
    this.state = state;
    const key = JSON.stringify([state.currentMapLevel, state.highestUnlockedMapLevel, state.tutorial, state.config.autoAdvanceLevel]);
    if (key === this.key) return;
    this.key = key;
    this.render();
  }

  layout(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.render();
  }

  private render(): void {
    this.tutorialTarget = undefined;
    for (const child of this.removeChildren()) child.destroy({ children: true });
    if (!this.state) return;
    const content = new Container();
    const width = 440;
    const scale = Math.max(0.001, Math.min(1, (this.viewWidth - 24) / width, this.viewHeight / 250));
    const height = this.viewHeight / scale;
    content.scale.set(scale);
    content.x = (this.viewWidth - width * scale) / 2;
    this.addChild(content);
    const text = (value: string, x: number, y: number, size: number, color = 0xe7f8f4) => {
      const label = new Text({ text: value, resolution: 2, style: {
        fontFamily: "system-ui, sans-serif", fontSize: size, fill: color,
      } });
      label.position.set(x, y);
      label.eventMode = "none";
      return label;
    };
    content.addChild(text("选择关卡", 0, 16, 22), text("点击已解锁关卡，立即开始挑战", 0, 46, 13, 0xb8cbd6));
    const autoAdvance = this.state.config.autoAdvanceLevel;
    const toggle = new Container();
    toggle.label = "auto-advance-level";
    toggle.position.set(0, 72);
    toggle.eventMode = "static";
    toggle.interactiveChildren = false;
    toggle.cursor = this.onAutoAdvanceChange ? "pointer" : "default";
    toggle.hitArea = new Rectangle(0, 0, width, 54);
    toggle.addChild(new Graphics().roundRect(0, 0, width, 54, 6).fill(0x142630)
      .stroke({ color: autoAdvance ? 0x83d8ca : 0x516768, width: 1 }));
    toggle.addChild(text("胜利后自动挑战下一关", 12, 7, 16));
    toggle.addChild(text(autoAdvance ? "仅通关已解锁的最后一关时推进" : "关闭时重复当前关卡", 12, 30, 12, 0xb8cbd6));
    toggle.addChild(new Graphics().roundRect(width - 60, 15, 46, 24, 12).fill(autoAdvance ? 0x4f9e8b : 0x40505a)
      .circle(width - (autoAdvance ? 26 : 48), 27, 9).fill(0xe7f8f4));
    toggle.on("pointertap", event => {
      event.stopPropagation();
      if (event.button === 0) this.onAutoAdvanceChange?.(!autoAdvance);
    });
    content.addChild(toggle);
    const levels = [...this.data.mapLevelDefinitions].sort((a, b) => a.level[0] - b.level[0] || a.level[1] - b.level[1]);
    const pageSize = Math.max(1, Math.floor((height - 180) / 70));
    const pages = Math.max(1, Math.ceil(levels.length / pageSize));
    this.page = Math.min(this.page, pages - 1);
    const pending = levelTutorialPending(this.state);
    if (pending) {
      const target = levels.findIndex(({ level }) => level[0] === 1 && level[1] === 2);
      if (target >= 0) this.page = Math.floor(target / pageSize);
    }
    const highest = this.state.highestUnlockedMapLevel;
    levels.slice(this.page * pageSize, (this.page + 1) * pageSize).forEach((definition, index) => {
      const level = definition.level;
      const unlocked = level[0] < highest[0] || (level[0] === highest[0] && level[1] <= highest[1]);
      const current = level[0] === this.state!.currentMapLevel[0] && level[1] === this.state!.currentMapLevel[1];
      const row = new Container();
      row.y = 142 + index * 70;
      row.label = `level-${level.join("-")}`;
      if (pending && level[0] === 1 && level[1] === 2) this.tutorialTarget = row;
      row.eventMode = "static";
      row.cursor = unlocked && this.onSelect ? "pointer" : "default";
      row.hitArea = new Rectangle(0, 0, width, 60);
      row.addChild(new Graphics().roundRect(0, 0, width, 60, 6)
        .fill(current ? 0x254a4b : 0x142630)
        .stroke({ color: current ? 0x83d8ca : 0x516768, width: current ? 2 : 1 }));
      row.addChild(text(`${level.join("-")}  ${definition.name}`, 16, 10, 17, unlocked ? 0xe7f8f4 : 0x788993));
      row.addChild(text(!unlocked ? "未解锁" : current ? "点击重新挑战" : "点击立即挑战", 16, 35, 12, 0xb8cbd6));
      if (current) row.addChild(text("当前关卡", width - 78, 12, 12, 0x83d8ca));
      row.on("pointertap", event => {
        event.stopPropagation();
        if (event.button === 0 && unlocked) this.onSelect?.([...level]);
      });
      content.addChild(row);
    });
    if (pages > 1) {
      const y = 144 + pageSize * 70;
      for (const [label, x, direction] of [["上一页", 0, -1], ["下一页", 350, 1]] as const) {
        const button = text(label, x, y, 14);
        const enabled = this.page + direction >= 0 && this.page + direction < pages;
        button.alpha = enabled ? 1 : 0.4;
        button.eventMode = enabled ? "static" : "none";
        button.cursor = "pointer";
        button.on("pointertap", () => { this.page += direction; this.render(); });
        content.addChild(button);
      }
      content.addChild(text(`${this.page + 1} / ${pages}`, 200, y, 14));
    }
  }
}
