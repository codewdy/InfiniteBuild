import { describeTablet, TabletTooltipView } from "./tablet-tooltip.js";
import { createTabletArt, loadTabletArt } from "./tablet-art.js";
import type { TabletArt } from "./tablet-art.js";
import { Container, Graphics, Point, Rectangle, Sprite } from "pixi.js";
import { loadDrawerAssets } from "./drawer-assets.js";
import type { DrawerAssets } from "./drawer-assets.js";
import { TabletMap } from "@infinite-build/core";
import type { GameData, PlayerState, TabletSpec } from "@infinite-build/core";
import { Battlefield } from "@infinite-build/renderer";

const SLOT_SIZE = 80;
const SLOT_GAP = 8;
const SLOT_STEP = SLOT_SIZE + SLOT_GAP;
const GRID_PADDING = 40;
const BOARD_SIZE = GRID_PADDING * 2 + SLOT_STEP * 5 - SLOT_GAP;
const INVENTORY_COLUMNS = 4;
const INVENTORY_ROWS = 5;
const STACKED_INVENTORY_COLUMNS = 5;
const SECTION_GAP = 12;
const INVENTORY_X = BOARD_SIZE + SECTION_GAP;
const PANEL_PADDING = 16;
const BATTLEFIELD_MIN_ASPECT = 16 / 9;
const BATTLEFIELD_MAX_ASPECT = 21 / 9;

export type SlotLocation = { area: "tablets" | "inventory"; index: number };
export type GameUIOptions = {
  /** UI uses game definitions to render skill and affix descriptions. */
  gameData: GameData;
  /** The host validates and applies the move, then supplies the latest state. */
  onMoveTablet?: (uuid: string, target: SlotLocation) => void;
  /** The host rotates the support tablet clockwise and validates the new state. */
  onRotateTablet?: (uuid: string) => void;
};

/** Game screen composition with host-controlled inventory changes. */
export class GameUI {
  private readonly root = new Container();
  private readonly background: Sprite;
  private readonly panel = new Container();
  private readonly boardPanel = new Container();
  private readonly inventoryPanel = new Container();
  private inventoryBackground?: Sprite;
  private readonly inventorySlots: Container[] = [];
  private readonly clip = new Graphics();
  private readonly tooltip = new TabletTooltipView();
  private tooltipSelection?: { uuid: string; location: SlotLocation };
  private tooltipHover?: Container;
  private suppressTooltipTap = false;
  private pointerButton = 0;
  private destroyed = false;
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
  private uiHeight = 1;
  private capacity = 0;
  private contentKey = "";

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly battlefield: Battlefield,
    private readonly options: GameUIOptions,
    private readonly art: TabletArt,
    private readonly backgrounds: DrawerAssets,
  ) {
    this.panel.addChild(this.boardPanel, this.inventoryPanel);
    this.panel.eventMode = "static";
    this.panel.on("pointertap", event => {
      if (event.button === 0 && this.pointerButton === 0 && event.target === this.panel && !this.suppressTooltipTap) this.hideTooltip();
    });
    this.background = new Sprite(backgrounds.background);
    this.background.anchor.set(0.5);
    this.background.eventMode = "none";
    this.root.addChild(this.background, this.panel, this.tooltip, this.clip);
    this.root.mask = this.clip;
    battlefield.mountOverlay(this.root);
    this.observer = new ResizeObserver(() => this.layout());
    this.observer.observe(canvas);
    this.layout();
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("blur", this.cancelDrag);
    window.addEventListener("keydown", this.onKeyDown);
  }

  static async create(canvas: HTMLCanvasElement, options: GameUIOptions): Promise<GameUI> {
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
    const selection = this.tooltipSelection;
    this.renderPanel();
    if (selection) {
      const slot = this.slots.find(({ location }) => this.state?.[location.area][location.index]?.uuid === selection.uuid);
      if (slot) {
        this.tooltipSelection = { uuid: selection.uuid, location: slot.location };
        this.showTooltip(slot.view, slot.location);
      }
    }
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
    this.inventorySlots.length = 0;
    for (const group of [this.boardPanel, this.inventoryPanel]) {
      for (const child of group.removeChildren()) child.destroy({ children: true });
    }
    const board = new Sprite(this.backgrounds.board);
    board.width = board.height = BOARD_SIZE;
    const inventory = new Sprite(this.backgrounds.inventory);
    this.inventoryBackground = inventory;
    this.boardPanel.addChild(board);
    this.inventoryPanel.addChild(inventory);
    TabletMap.pos2Id.forEach((row, y) => row.forEach((index, x) => {
      const view = this.slot(this.state!.tablets[index], GRID_PADDING + x * SLOT_STEP, GRID_PADDING + y * SLOT_STEP);
      view.cursor = this.options.onMoveTablet && this.state!.tablets[index] ? "grab" : "default";
      view.eventMode = "static";
      const location: SlotLocation = { area: "tablets", index };
      this.slots.push({ location, view });
      this.bindTooltip(view, location);
      this.boardPanel.addChild(view);
    }));
    for (let index = 0; index < INVENTORY_COLUMNS * INVENTORY_ROWS; index++) {
      const view = this.slot(this.state.inventory[index], 0, 0);
      this.inventorySlots.push(view);
      const enabled = index < this.capacity;
      view.alpha = enabled ? 1 : 0.35;
      view.cursor = enabled && this.options.onMoveTablet && this.state.inventory[index] ? "grab" : "default";
      view.eventMode = "static";
      if (enabled) {
        const location: SlotLocation = { area: "inventory", index };
        this.slots.push({ location, view });
        this.bindTooltip(view, location);
      }
      this.inventoryPanel.addChild(view);
    }
    this.layout();
  }

  private bindTooltip(view: Container, location: SlotLocation): void {
    view.on("pointerover", event => {
      if (event.pointerType === "touch" || this.drag || this.tooltipSelection) return;
      this.tooltipHover = view;
      this.showTooltip(view, location);
    });
    view.on("pointerout", () => {
      if (this.tooltipSelection || this.tooltipHover !== view) return;
      this.hideTooltip();
    });
    view.on("pointertap", event => {
      if (event.button !== 0 || this.pointerButton !== 0 || this.suppressTooltipTap || this.drag?.moved) return;
      // Pixi may dispatch the tap before the window pointerup clears a pending drag.
      this.cancelDrag();
      const tablet = this.state?.[location.area][location.index];
      if (!tablet) {
        this.hideTooltip();
        return;
      }
      if (this.tooltipSelection?.uuid === tablet.uuid) {
        this.hideTooltip();
        return;
      }
      this.tooltipSelection = { uuid: tablet.uuid, location };
      this.tooltipHover = undefined;
      this.showTooltip(view, location);
    });
  }

  private showTooltip(view: Container, location: SlotLocation): void {
    const tablet = this.state?.[location.area][location.index];
    if (!tablet) {
      this.tooltip.hide();
      return;
    }
    this.tooltip.eventMode = this.tooltipSelection ? "static" : "none";
    const content = describeTablet(tablet, this.options.gameData, location.area);
    const origin = this.root.toLocal(view.toGlobal(new Point()));
    this.tooltip.show(content,
      new Rectangle(origin.x, origin.y, SLOT_SIZE * this.panel.scale.x, SLOT_SIZE * this.panel.scale.y),
      this.canvas.clientWidth, this.uiHeight, tablet.rarity === "rare",
      "rotate" in tablet && this.options.onRotateTablet ? () => {
        if (this.pointerButton === 0) this.rotateTablet(tablet.uuid);
      } : undefined,
    );
  }

  private hideTooltip(): void {
    this.tooltip.hide();
    this.tooltipHover = undefined;
    this.tooltipSelection = undefined;
  }

  private rotateTablet(uuid: string, lockTooltip = true): void {
    if (this.drag || !this.options.onRotateTablet) return;
    const slot = this.slots.find(({ location }) => {
      const tablet = this.state?.[location.area][location.index];
      return tablet?.uuid === uuid && "rotate" in tablet;
    });
    if (!slot) return;
    const selectedUuid = lockTooltip ? uuid : this.tooltipSelection?.uuid;
    if (lockTooltip) this.tooltipSelection = { uuid, location: slot.location };
    this.options.onRotateTablet(uuid);
    const displayUuid = selectedUuid ?? uuid;
    const updated = this.slots.find(({ location }) => this.state?.[location.area][location.index]?.uuid === displayUuid);
    if (updated) {
      this.tooltipSelection = selectedUuid ? { uuid: selectedUuid, location: updated.location } : undefined;
      this.tooltipHover = selectedUuid ? undefined : updated.view;
      this.showTooltip(updated.view, updated.location);
    } else this.hideTooltip();
  }

  private pointerInTooltip(event: MouseEvent, interactiveOnly = true): boolean {
    if (!this.tooltip.visible || (interactiveOnly && this.tooltip.eventMode === "none") || !(this.tooltip.hitArea instanceof Rectangle)) return false;
    const bounds = this.canvas.getBoundingClientRect();
    const point = this.tooltip.toLocal(new Point(
      (event.clientX - bounds.left) * this.canvas.clientWidth / bounds.width,
      (event.clientY - bounds.top) * this.canvas.clientHeight / bounds.height,
    ));
    return this.tooltip.hitArea.contains(point.x, point.y);
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.drag || !this.options.onRotateTablet) return;
    if (this.pointerInTooltip(event, false)) {
      event.preventDefault();
      return;
    }
    const slot = this.slotAt(this.pointerPosition(event));
    const tablet = slot && this.state?.[slot.location.area][slot.location.index];
    if (!tablet || !("rotate" in tablet)) return;
    event.preventDefault();
    this.rotateTablet(tablet.uuid, false);
  };

  private pointerPosition(event: MouseEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return this.panel.toLocal(new Point(
      (event.clientX - bounds.left) * this.canvas.clientWidth / bounds.width,
      (event.clientY - bounds.top) * this.canvas.clientHeight / bounds.height,
    ));
  }

  private slotAt(point: Point) {
    return this.slots.find(({ view }) => {
      const origin = this.panel.toLocal(view.toGlobal(new Point()));
      return point.x >= origin.x && point.x < origin.x + SLOT_SIZE && point.y >= origin.y && point.y < origin.y + SLOT_SIZE;
    });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.suppressTooltipTap = false;
    this.pointerButton = event.button;
    if (this.pointerInTooltip(event)) return;
    if (event.button !== 0 || this.drag || !this.options.onMoveTablet) return;
    const point = this.pointerPosition(event);
    const source = this.slotAt(point);
    if (!source) return;
    const tablet = this.state?.[source.location.area][source.location.index];
    if (!tablet) return;
    event.preventDefault();
    this.tooltip.hide();
    const ghost = this.slot(tablet, point.x - SLOT_SIZE / 2, point.y - SLOT_SIZE / 2);
    ghost.eventMode = "none";
    ghost.visible = false;
    this.panel.addChild(ghost);
    this.drag = { pointerId: event.pointerId, uuid: tablet.uuid, source: source.view, ghost, startX: event.clientX, startY: event.clientY, moved: false };
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) {
      // A state refresh replaces the hovered slot, so pointerout may target a destroyed view.
      if (this.tooltip.visible && !this.tooltipSelection
        && this.slotAt(this.pointerPosition(event))?.view !== this.tooltipHover) this.hideTooltip();
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
    drag.moved = true;
    this.suppressTooltipTap = true;
    this.hideTooltip();
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
    else if (this.tooltip.visible) this.hideTooltip();
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
    this.cancelDrag();
    this.hideTooltip();
    const width = Math.max(1, this.canvas.clientWidth);
    const stacked = width < 700;
    const inventoryColumns = stacked ? STACKED_INVENTORY_COLUMNS : INVENTORY_COLUMNS;
    const inventoryRows = Math.ceil(INVENTORY_COLUMNS * INVENTORY_ROWS / inventoryColumns);
    const inventoryWidth = GRID_PADDING * 2 + SLOT_STEP * inventoryColumns - SLOT_GAP;
    const inventoryHeight = GRID_PADDING * 2 + SLOT_STEP * inventoryRows - SLOT_GAP;
    const contentWidth = stacked ? Math.max(BOARD_SIZE, inventoryWidth) : INVENTORY_X + inventoryWidth;
    const contentHeight = stacked ? BOARD_SIZE + SECTION_GAP + inventoryHeight : Math.max(BOARD_SIZE, inventoryHeight);
    if (this.inventoryBackground) {
      this.inventoryBackground.texture = stacked ? this.backgrounds.inventoryWide : this.backgrounds.inventory;
      this.inventoryBackground.width = inventoryWidth;
      this.inventoryBackground.height = inventoryHeight;
    }
    this.inventorySlots.forEach((view, index) => {
      view.position.set(
        GRID_PADDING + (index % inventoryColumns) * SLOT_STEP,
        GRID_PADDING + Math.floor(index / inventoryColumns) * SLOT_STEP,
      );
    });
    const canvasHeight = Math.max(1, this.canvas.clientHeight);
    const battlefieldHeight = Math.max(width / BATTLEFIELD_MAX_ASPECT,
      Math.min(canvasHeight / 2, width / BATTLEFIELD_MIN_ASPECT));
    const height = Math.max(1, canvasHeight - battlefieldHeight);
    this.uiHeight = height;
    const scale = Math.max(0.001, Math.min(1,
      (width - PANEL_PADDING * 2) / contentWidth,
      (height - PANEL_PADDING * 2) / contentHeight,
    ));
    this.battlefield.setViewport(width, battlefieldHeight);
    this.root.position.set(0, battlefieldHeight);
    const backgroundScale = Math.max(width / this.background.texture.width, height / this.background.texture.height);
    this.background.scale.set(backgroundScale);
    this.background.position.set(width / 2, height / 2);
    this.panel.scale.set(scale);
    this.panel.position.set((width - contentWidth * scale) / 2, (height - contentHeight * scale) / 2);
    this.panel.hitArea = new Rectangle(0, 0, contentWidth, contentHeight);
    this.inventoryPanel.position.set(stacked ? (contentWidth - inventoryWidth) / 2 : INVENTORY_X, stacked ? BOARD_SIZE + SECTION_GAP : 0);
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelDrag();
    this.hideTooltip();
    this.highlight.destroy();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
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
