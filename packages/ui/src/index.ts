import { createTabletArt, loadTabletArt } from "./tablet-art.js";
import type { TabletArt } from "./tablet-art.js";
import { Container, Graphics, Point, Rectangle, Sprite } from "pixi.js";
import { loadDrawerAssets } from "./drawer-assets.js";
import type { DrawerAssets } from "./drawer-assets.js";
import { TabletMap } from "@infinite-build/core";
import type { PlayerState, TabletSpec } from "@infinite-build/core";
import { Battlefield } from "@infinite-build/renderer";

const SLOT_SIZE = 80;
const SLOT_GAP = 8;
const SLOT_STEP = SLOT_SIZE + SLOT_GAP;
const GRID_PADDING = 40;
const BOARD_SIZE = GRID_PADDING * 2 + SLOT_STEP * 5 - SLOT_GAP;
const INVENTORY_COLUMNS = 4;
const INVENTORY_ROWS = 5;
const INVENTORY_WIDTH = GRID_PADDING * 2 + SLOT_STEP * INVENTORY_COLUMNS - SLOT_GAP;
const SECTION_GAP = 12;
const INVENTORY_X = BOARD_SIZE + SECTION_GAP;
const CONTENT_WIDTH = INVENTORY_X + INVENTORY_WIDTH;
const DRAWER_PADDING = 16;

export type SlotLocation = { area: "tablets" | "inventory"; index: number };
export type GameUIOptions = {
  /** The host validates and applies the move, then supplies the latest state. */
  onMoveTablet?: (uuid: string, target: SlotLocation) => void;
};

/** Game screen composition with host-controlled inventory changes. */
export class GameUI {
  private readonly root = new Container();
  private readonly panel = new Container();
  private readonly drawer = new Container();
  private readonly drawerBackground = new Graphics();
  private readonly backdrop = new Graphics();
  private readonly clip = new Graphics();
  private opened = false;
  private openness = 0;
  private drawerWidth = 0;
  private animation?: number;
  private destroyed = false;
  private readonly button = new Container();
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
  private readonly highlight = new Graphics().roundRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8).stroke({ color: 0x82e6ce, width: 2 });
  private capacity = 0;
  private contentKey = "";

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly battlefield: Battlefield,
    private readonly options: GameUIOptions,
    private readonly art: TabletArt,
    private readonly backgrounds: DrawerAssets,
  ) {
    this.button.addChild(new Graphics().roundRect(0, 0, 40, 40, 8).fill(0x172738).stroke({ color: 0x78b8ff, width: 1 }));
    const symbol = new Graphics();
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 2; column++) {
        symbol.roundRect(10 + column * 12, 10 + row * 12, 8, 8, 2).fill(0xb4dce7);
      }
    }
    this.button.addChild(symbol);
    this.button.eventMode = "static";
    this.button.cursor = "pointer";
    this.button.on("pointertap", () => this.setOpen(!this.opened));
    this.backdrop.eventMode = "static";
    this.backdrop.on("pointertap", () => this.setOpen(false));
    this.drawer.eventMode = "static";
    this.drawer.addChild(this.drawerBackground, this.panel);
    this.root.addChild(this.backdrop, this.drawer, this.button, this.clip);
    this.root.mask = this.clip;
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
    const art = await loadTabletArt();
    try {
      const backgrounds = await loadDrawerAssets();
      return new GameUI(canvas, await Battlefield.create(canvas), options, art, backgrounds);
    } catch (error) {
      art.destroy();
      throw error;
    }
  }

  update(state: PlayerState, inventoryCapacity: number): void {
    const key = JSON.stringify([state.tablets, state.inventory, inventoryCapacity]);
    if (key === this.contentKey) return;
    this.contentKey = key;
    this.state = state;
    this.capacity = inventoryCapacity;
    this.renderPanel();
  }

  private slot(tablet: TabletSpec.Slot | undefined, x: number, y: number): Container {
    const slot = new Container();
    slot.position.set(x, y);
    slot.hitArea = new Rectangle(0, 0, SLOT_SIZE, SLOT_SIZE);
    const color = !tablet ? 0x101923 : tablet.kind === "tablet-skill" ? 0x362941 : 0x193d36;
    slot.addChild(new Graphics().roundRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8)
      .fill({ color, alpha: tablet ? 0.7 : 0.4 }).stroke({ color: tablet ? 0x60717f : 0x3b4b54, width: 1, alpha: 0.7 }));
    if (tablet) {
      const artwork = createTabletArt(tablet, this.art, 72);
      artwork.position.set(SLOT_SIZE / 2);
      slot.addChild(artwork);
    }
    return slot;
  }

  private renderPanel(): void {
    if (!this.state) return;
    this.cancelDrag();
    this.slots.length = 0;
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const board = new Sprite(this.backgrounds.board);
    board.width = board.height = BOARD_SIZE;
    const inventory = new Sprite(this.backgrounds.inventory);
    inventory.position.set(INVENTORY_X, 0);
    inventory.width = INVENTORY_WIDTH;
    inventory.height = BOARD_SIZE;
    this.panel.addChild(board, inventory);
    TabletMap.pos2Id.forEach((row, y) => row.forEach((index, x) => {
      const view = this.slot(this.state!.tablets[index], GRID_PADDING + x * SLOT_STEP, GRID_PADDING + y * SLOT_STEP);
      view.cursor = this.options.onMoveTablet && this.state!.tablets[index] ? "grab" : "default";
      view.eventMode = "static";
      this.slots.push({ location: { area: "tablets", index }, view });
      this.panel.addChild(view);
    }));
    for (let index = 0; index < INVENTORY_COLUMNS * INVENTORY_ROWS; index++) {
      const view = this.slot(this.state.inventory[index], INVENTORY_X + GRID_PADDING + (index % INVENTORY_COLUMNS) * SLOT_STEP, GRID_PADDING + Math.floor(index / INVENTORY_COLUMNS) * SLOT_STEP);
      const enabled = index < this.capacity;
      view.alpha = enabled ? 1 : 0.35;
      view.cursor = enabled && this.options.onMoveTablet && this.state.inventory[index] ? "grab" : "default";
      view.eventMode = "static";
      if (enabled) this.slots.push({ location: { area: "inventory", index }, view });
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
    return this.slots.find(({ view }) => point.x >= view.x && point.x < view.x + SLOT_SIZE && point.y >= view.y && point.y < view.y + SLOT_SIZE);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.drag || !this.opened || this.animation !== undefined || !this.options.onMoveTablet) return;
    const point = this.pointerPosition(event);
    const source = this.slotAt(point);
    if (!source) return;
    const tablet = this.state?.[source.location.area][source.location.index];
    if (!tablet) return;
    event.preventDefault();
    const ghost = this.slot(tablet, point.x - SLOT_SIZE / 2, point.y - SLOT_SIZE / 2);
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
    drag.ghost.position.set(point.x - SLOT_SIZE / 2, point.y - SLOT_SIZE / 2);
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
    if (event.key !== "Escape") return;
    if (this.drag) this.cancelDrag();
    else this.setOpen(false);
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

  private setOpen(open: boolean): void {
    if (this.destroyed || this.opened === open) return;
    this.cancelDrag();
    this.opened = open;
    if (this.animation !== undefined) window.cancelAnimationFrame(this.animation);
    const from = this.openness;
    const target = open ? 1 : 0;
    const startedAt = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
    const animate = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      this.openness = from + (target - from) * eased;
      this.positionDrawer();
      this.animation = progress < 1 ? window.requestAnimationFrame(animate) : undefined;
    };
    animate(startedAt);
  }

  private positionDrawer(): void {
    this.drawer.position.set(this.canvas.clientWidth - this.drawerWidth * this.openness, 0);
    this.drawer.visible = this.backdrop.visible = this.openness > 0;
    this.backdrop.alpha = this.openness;
    this.button.visible = !this.opened && this.openness === 0;
  }

  private layout(): void {
    this.cancelDrag();
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.button.position.set(12, 12);
    const scale = Math.max(0.001, Math.min(1,
      (width - DRAWER_PADDING * 2) / CONTENT_WIDTH,
      (height - DRAWER_PADDING * 2) / BOARD_SIZE,
    ));
    this.panel.scale.set(scale);
    this.panel.position.set(DRAWER_PADDING, Math.max(0, (height - BOARD_SIZE * scale) / 2));
    this.drawerWidth = CONTENT_WIDTH * scale + DRAWER_PADDING * 2;
    this.drawerBackground.clear().rect(0, 0, this.drawerWidth, height).fill({ color: 0x0c141d, alpha: 0.98 })
      .moveTo(0, 0).lineTo(0, height).stroke({ color: 0x54717c, width: 2 });
    this.drawer.hitArea = new Rectangle(0, 0, this.drawerWidth, height);
    this.backdrop.clear().rect(0, 0, width, height).fill({ color: 0x040910, alpha: 0.48 });
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
    this.positionDrawer();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animation !== undefined) window.cancelAnimationFrame(this.animation);
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
    this.art.destroy();
  }
}
