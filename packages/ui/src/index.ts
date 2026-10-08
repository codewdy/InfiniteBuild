import { Container, Graphics, Point, Text } from "pixi.js";
import { TabletMap } from "@infinite-build/core";
import type { PlayerState, TabletSpec } from "@infinite-build/core";
import { Battlefield } from "@infinite-build/renderer";

function text(value: string, size: number, color = 0xe6edf7): Text {
  return new Text({ text: value, style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill: color } });
}

export type SlotLocation = { area: "tablets" | "inventory"; index: number };
export type GameUIOptions = {
  /** The host validates and applies the move, then supplies the latest state. */
  onMoveTablet?: (uuid: string, target: SlotLocation) => void;
};

/** Game screen composition with host-controlled inventory changes. */
export class GameUI {
  private readonly root = new Container();
  private readonly panel = new Container();
  private readonly button = new Container();
  private readonly buttonLabel = text("石板 / 背包", 14);
  private readonly observer: ResizeObserver;
  private state?: PlayerState;
  private readonly slots: { location: SlotLocation; view: Container }[] = [];
  private drag?: {
    pointerId: number;
    uuid: string;
    source: Container;
    ghost: Container;
    startX: number;
    startY: number;
    moved: boolean;
  };
  private hovered?: Container;
  private readonly highlight = new Graphics().roundRect(0, 0, 50, 50, 6).stroke({ color: 0x82e6ce, width: 2 });
  private capacity = 0;
  private contentKey = "";
  private panelWidth = 690;
  private panelHeight = 360;

  private constructor(private readonly canvas: HTMLCanvasElement, readonly battlefield: Battlefield, private readonly options: GameUIOptions) {
    this.button.addChild(new Graphics().roundRect(0, 0, 120, 36, 8).fill(0x202d42).stroke({ color: 0x78b8ff, width: 1 }));
    this.buttonLabel.position.set(12, 9);
    this.button.addChild(this.buttonLabel);
    this.button.eventMode = "static";
    this.button.cursor = "pointer";
    this.button.on("pointertap", () => {
      this.cancelDrag();
      this.panel.visible = !this.panel.visible;
      this.buttonLabel.text = this.panel.visible ? "收起面板" : "石板 / 背包";
    });
    this.panel.visible = false;
    this.panel.eventMode = "static";
    this.root.addChild(this.button, this.panel);
    battlefield.mountOverlay(this.root);
    this.observer = new ResizeObserver(() => this.layout());
    this.observer.observe(canvas);
    this.layout();
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("blur", this.cancelDrag);
    window.addEventListener("keydown", this.onKeyDown);
  }

  static async create(canvas: HTMLCanvasElement, options: GameUIOptions = {}): Promise<GameUI> {
    return new GameUI(canvas, await Battlefield.create(canvas), options);
  }

  update(state: PlayerState, inventoryCapacity: number): void {
    const key = JSON.stringify([state.tablets, state.inventory, inventoryCapacity]);
    if (key === this.contentKey) return;
    this.contentKey = key;
    this.state = state;
    this.capacity = inventoryCapacity;
    this.renderPanel();
  }

  private slot(tablet: TabletSpec.Slot | undefined, index: number, x: number, y: number): Container {
    const slot = new Container();
    slot.position.set(x, y);
    const color = !tablet ? 0x121c2b : tablet.kind === "tablet-skill" ? 0x49304a : 0x204139;
    slot.addChild(new Graphics().roundRect(0, 0, 50, 50, 6).fill(color).stroke({ color: index === 0 ? 0xbfa278 : 0x43516c, width: 1 }));
    const number = text(String(index).padStart(2, "0"), 9, 0x92a3b9);
    number.position.set(5, 4);
    const name = !tablet ? "空槽" : tablet.kind === "tablet-skill" ? (tablet.skill === "nova" ? "新星" : tablet.skill === "fireball" ? "火球" : "技能") : tablet.kind === "tablet-passive" ? "被动" : "辅助";
    const label = text(name, 12);
    label.position.set(11, 19);
    slot.addChild(number, label);
    if (tablet) {
      const rarity = text(tablet.rarity === "rare" ? "稀有" : "魔法", 9, tablet.rarity === "rare" ? 0xffc45e : 0x79b8ff);
      rarity.position.set(15, 36);
      slot.addChild(rarity);
    }
    return slot;
  }

  private renderPanel(): void {
    if (!this.state) return;
    this.cancelDrag();
    this.slots.length = 0;
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const columns = 6;
    const rows = Math.ceil(this.capacity / columns);
    this.panelHeight = Math.max(360, 90 + rows * 56);
    this.panel.addChild(new Graphics().roundRect(0, 0, this.panelWidth, this.panelHeight, 12).fill({ color: 0x141e2e, alpha: 0.97 }).stroke({ color: 0x43516c, width: 1 }));
    const boardTitle = text("石板盘", 18);
    boardTitle.position.set(20, 18);
    const used = this.state.inventory.slice(0, this.capacity).filter(Boolean).length;
    const inventoryTitle = text(`背包  ${used} / ${this.capacity}`, 18);
    inventoryTitle.position.set(330, 18);
    const hint = text(this.options.onMoveTablet ? "拖到空槽移动 · 拖到石板交换 · Esc 取消" : "石板盘与背包预览", 12, 0x92a3b9);
    hint.position.set(20, this.panelHeight - 26);
    this.panel.addChild(boardTitle, inventoryTitle, hint);
    TabletMap.pos2Id.forEach((row, y) => row.forEach((index, x) => {
      const view = this.slot(this.state!.tablets[index], index, 20 + x * 56, 55 + y * 56);
      view.cursor = this.options.onMoveTablet && this.state!.tablets[index] ? "grab" : "default";
      view.eventMode = "static";
      this.slots.push({ location: { area: "tablets", index }, view });
      this.panel.addChild(view);
    }));
    for (let index = 0; index < this.capacity; index++) {
      const view = this.slot(this.state.inventory[index], index, 330 + (index % columns) * 56, 55 + Math.floor(index / columns) * 56);
      view.cursor = this.options.onMoveTablet && this.state.inventory[index] ? "grab" : "default";
      view.eventMode = "static";
      this.slots.push({ location: { area: "inventory", index }, view });
      this.panel.addChild(view);
    }
    this.layout();
  }

  private pointerPosition(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return this.panel.toLocal(new Point(
      (event.clientX - bounds.left) * this.canvas.clientWidth / bounds.width,
      (event.clientY - bounds.top) * this.canvas.clientHeight / bounds.height,
    ));
  }

  private slotAt(point: Point) {
    return this.slots.find(({ view }) => point.x >= view.x && point.x < view.x + 50 && point.y >= view.y && point.y < view.y + 50);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.drag || !this.panel.visible || !this.options.onMoveTablet) return;
    const point = this.pointerPosition(event);
    const source = this.slotAt(point);
    if (!source) return;
    const tablet = this.state?.[source.location.area][source.location.index];
    if (!tablet) return;
    event.preventDefault();
    const ghost = this.slot(tablet, source.location.index, point.x - 25, point.y - 25);
    ghost.eventMode = "none";
    ghost.visible = false;
    this.panel.addChild(ghost);
    this.drag = { pointerId: event.pointerId, uuid: tablet.uuid, source: source.view, ghost, startX: event.clientX, startY: event.clientY, moved: false };
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
    drag.moved = true;
    drag.source.alpha = 0.35;
    drag.ghost.visible = true;
    const point = this.pointerPosition(event);
    drag.ghost.position.set(point.x - 25, point.y - 25);
    const target = this.slotAt(point)?.view;
    if (target !== this.hovered) {
      this.highlight.removeFromParent();
      this.hovered = target;
      if (target) target.addChild(this.highlight);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const target = this.slotAt(this.pointerPosition(event));
    const shouldMove = drag.moved && target && target.view !== drag.source;
    this.cancelDrag();
    if (shouldMove) this.options.onMoveTablet?.(drag.uuid, target.location);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.drag?.pointerId) this.cancelDrag();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.cancelDrag();
  };

  private readonly cancelDrag = (): void => {
    this.highlight.removeFromParent();
    this.hovered = undefined;
    if (this.drag) {
      this.drag.source.alpha = 1;
      this.drag.ghost.destroy({ children: true });
      this.drag = undefined;
    }
  };

  private layout(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.button.position.set(12, 12);
    const scale = Math.max(0.001, Math.min(1, (width - 24) / this.panelWidth, (height - 72) / this.panelHeight));
    this.panel.scale.set(scale);
    this.panel.position.set((width - this.panelWidth * scale) / 2, 60);
  }

  destroy(): void {
    this.cancelDrag();
    this.highlight.destroy();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("blur", this.cancelDrag);
    window.removeEventListener("keydown", this.onKeyDown);
    this.observer.disconnect();
    this.battlefield.destroy();
  }
}
