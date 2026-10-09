import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import type { Texture } from "pixi.js";
import type { PlayerState } from "@infinite-build/core";
import type { TabletArt } from "./tablet-art.js";

export type PendingLootItem = PlayerState["pendingLoot"][number]["loot"];

const LOOT_ICON_SIZE = 72;
const TYPE_BADGE_WIDTH = 30;
const names: Record<PendingLootItem["kind"], string> = {
  "tablet-skill": "技能石板",
  "tablet-passive": "被动石板",
  "tablet-support-skill": "辅助技能石板",
  "tablet-support-passive": "辅助被动石板",
};

const typeLabels: Record<PendingLootItem["kind"], string> = {
  "tablet-skill": "技能",
  "tablet-passive": "被动",
  "tablet-support-skill": "技能\n辅助",
  "tablet-support-passive": "被动\n辅助",
};

/** Paginated loot content for the shared canvas loot tab. */
export class PendingLootView extends Container {
  private state?: PlayerState;
  private capacity = 0;
  private viewWidth = 1;
  private viewHeight = 1;
  private page = 0;
  private selectedLoot?: PendingLootItem;

  constructor(
    private readonly icons: TabletArt["icons"],
    private readonly skillIcons: Record<PendingLootItem["rarity"], Texture>,
    private readonly onClaim?: (loot: PendingLootItem, count?: number) => void,
  ) {
    super();
    this.eventMode = "static";
    this.on("pointertap", event => {
      event.stopPropagation();
      if (event.button === 0) this.closeMenu();
    });
  }

  closeMenu(): void {
    if (!this.selectedLoot) return;
    this.selectedLoot = undefined;
    this.render();
  }

  private isSelected(loot: PendingLootItem): boolean {
    return this.selectedLoot?.kind === loot.kind && this.selectedLoot.rarity === loot.rarity
      && this.selectedLoot.level === loot.level;
  }

  update(state: PlayerState, capacity: number): void {
    this.state = state;
    this.capacity = capacity;
    if (this.selectedLoot && !state.pendingLoot.some(({ loot }) => this.isSelected(loot))) this.selectedLoot = undefined;
    this.render();
  }

  layout(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.hitArea = new Rectangle(0, 0, width, height);
    this.render();
  }

  private text(value: string, x: number, y: number, size = 15, color = 0xdce5e9): Text {
    const text = new Text({ text: value, resolution: 2,
      style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill: color } });
    text.position.set(x, y);
    text.eventMode = "none";
    return text;
  }

  private button(label: string, x: number, y: number, width: number, height: number,
    enabled: boolean, action: () => void): Container {
    const button = new Container();
    button.position.set(x, y);
    button.hitArea = new Rectangle(0, 0, width, height);
    button.eventMode = "static";
    button.interactiveChildren = false;
    button.cursor = enabled ? "pointer" : "default";
    button.alpha = enabled ? 1 : 0.45;
    button.addChild(new Graphics().roundRect(0, 0, width, height, 6)
      .fill(0x253a43).stroke({ color: 0x6e827a, width: 1 }));
    const text = this.text(label, width / 2, height / 2, 14);
    text.anchor.set(0.5);
    button.addChild(text);
    button.on("pointertap", event => {
      event.stopPropagation();
      if (enabled && event.button === 0) action();
    });
    return button;
  }

  private render(): void {
    for (const child of this.removeChildren()) child.destroy({ children: true });
    if (!this.state) return;
    const entries = this.state.pendingLoot;
    const width = Math.max(1, this.viewWidth);
    const height = Math.max(1, this.viewHeight);
    const padding = Math.min(12, width / 16, height / 16);
    const gap = padding;
    const headerHeight = Math.min(48, height / 4);
    const footerHeight = Math.min(40, height / 4);
    const fitGrid = (footer: number) => {
      const availableWidth = Math.max(1, width - padding * 2);
      const availableHeight = Math.max(1, height - headerHeight - footer - padding * 2);
      const size = Math.max(1, Math.min(LOOT_ICON_SIZE, availableWidth, availableHeight));
      const columns = Math.max(1, Math.floor((availableWidth + gap) / (size + gap)));
      const rows = Math.max(1, Math.floor((availableHeight + gap) / (size + gap)));
      return { size, columns, rows };
    };
    let grid = fitGrid(0);
    if (entries.length > grid.columns * grid.rows) grid = fitGrid(footerHeight);
    const pageSize = grid.columns * grid.rows;
    const pages = Math.max(1, Math.ceil(entries.length / pageSize));
    const selectedIndex = entries.findIndex(({ loot }) => this.isSelected(loot));
    if (selectedIndex >= 0) this.page = Math.floor(selectedIndex / pageSize);
    this.page = Math.min(this.page, pages - 1);
    const step = grid.size + gap;
    const gridX = (width - (grid.columns * step - gap)) / 2;
    const gridY = headerHeight + padding;
    const panel = new Container();
    panel.eventMode = "static";
    panel.hitArea = new Rectangle(0, 0, width, height);
    const header = new Container();
    header.scale.set(headerHeight / 48);
    const icon = new Sprite(this.icons.pending);
    icon.width = icon.height = 30;
    icon.position.set(14, 10);
    header.addChild(icon, this.text("待领取掉落", 52, 16, 18, 0xe7cf96));
    panel.addChild(header);
    const used = this.state.inventory.slice(0, this.capacity).filter(Boolean).length;
    const free = Math.max(0, this.capacity - used);
    const canClaim = free > 0 && !!this.onClaim;
    entries.slice(this.page * pageSize, (this.page + 1) * pageSize).forEach(({ loot, count }, index) => {
      const card = new Container();
      card.position.set(gridX + (index % grid.columns) * step, gridY + Math.floor(index / grid.columns) * step);
      card.scale.set(grid.size / LOOT_ICON_SIZE);
      card.label = `${names[loot.kind]} · ${loot.rarity === "rare" ? "稀有" : "魔法"} · 等级 ${loot.level} · ${count} 件`;
      const rare = loot.rarity === "rare";
      const tile = new Container();
      tile.eventMode = "static";
      tile.interactiveChildren = false;
      tile.cursor = "pointer";
      tile.hitArea = new Rectangle(0, 0, LOOT_ICON_SIZE, LOOT_ICON_SIZE);
      tile.label = card.label;
      tile.on("pointertap", event => {
        event.stopPropagation();
        if (event.button !== 0) return;
        this.selectedLoot = this.isSelected(loot) ? undefined : { ...loot };
        this.render();
      });
      tile.addChild(new Graphics().roundRect(0, 0, LOOT_ICON_SIZE, LOOT_ICON_SIZE, 8)
        .fill(rare ? 0x332c20 : 0x1b2c38).stroke({ color: this.isSelected(loot) ? 0x91f0c8 : rare ? 0xc6a052 : 0x6297bf, width: 2 }));
      // A pending skill is not rolled yet: use a generic tablet, not a specific spell.
      const texture = loot.kind === "tablet-skill" ? this.skillIcons[loot.rarity]
        : loot.kind === "tablet-passive" ? this.icons[rare ? "passive-rare" : "passive-magic"]
        : this.icons[loot.kind === "tablet-support-skill" ? "support-skill" : "support-passive"];
      const tablet = new Sprite(texture);
      tablet.anchor.set(0.5);
      tablet.position.set(LOOT_ICON_SIZE / 2);
      // The generated random-skill asset already includes transparent gutters.
      // Atlas-cropped passive/support icons need explicit padding inside the slot.
      const artworkSize = loot.kind === "tablet-skill" ? LOOT_ICON_SIZE - 4 : LOOT_ICON_SIZE * 0.75;
      tablet.width = tablet.height = artworkSize;
      tile.addChild(tablet);
      const typeLabel = typeLabels[loot.kind];
      const typeHeight = typeLabel.includes("\n") ? 30 : 18;
      tile.addChild(new Graphics().roundRect(0, LOOT_ICON_SIZE - typeHeight, TYPE_BADGE_WIDTH, typeHeight, 4)
        .fill({ color: 0x08121c, alpha: 0.94 }));
      const typeText = this.text(typeLabel, 4, LOOT_ICON_SIZE - 3, 11, 0xd0e3ec);
      typeText.anchor.set(0, 1);
      typeText.style.lineHeight = 12;
      tile.addChild(typeText);
      for (const [label, bottom] of [[`×${count}`, false], [`Lv.${loot.level}`, true]] as const) {
        const maxBadgeWidth = bottom ? LOOT_ICON_SIZE - TYPE_BADGE_WIDTH - 2 : LOOT_ICON_SIZE - 4;
        const badgeWidth = Math.min(maxBadgeWidth, Math.max(30, label.length * 8 + 8));
        const badgeY = bottom ? LOOT_ICON_SIZE - 20 : 0;
        tile.addChild(new Graphics().roundRect(LOOT_ICON_SIZE - badgeWidth, badgeY, badgeWidth, 20, 4)
          .fill({ color: 0x08121c, alpha: 0.94 }));
        const badge = this.text(label, LOOT_ICON_SIZE - 4, bottom ? LOOT_ICON_SIZE - 3 : 3,
          Math.min(13, (badgeWidth - 8) / (label.length * 0.65)), bottom ? 0xe7cf96 : 0xf0f5ff);
        badge.anchor.set(1, bottom ? 1 : 0);
        tile.addChild(badge);
      }
      card.addChild(tile);
      panel.addChild(card);
    });
    if (entries.length === 0) {
      const empty = this.text("暂无待领取掉落", width / 2, height / 2, 18, 0x9eafb5);
      empty.anchor.set(0.5);
      panel.addChild(empty);
    }
    if (pages > 1) {
      const footer = new Container();
      const footerScale = footerHeight / 40;
      footer.scale.set(footerScale);
      footer.position.set(0, height - footerHeight);
      const footerWidth = width / footerScale;
      const pageLabel = this.text(`${this.page + 1} / ${pages}`, footerWidth / 2, 20, 14);
      pageLabel.anchor.set(0.5);
      footer.addChild(pageLabel);
      footer.addChild(this.button("上一页", padding / footerScale, 4, 86, 32, this.page > 0,
        () => { this.page--; this.selectedLoot = undefined; this.render(); }));
      footer.addChild(this.button("下一页", footerWidth - padding / footerScale - 86, 4, 86, 32, this.page + 1 < pages,
        () => { this.page++; this.selectedLoot = undefined; this.render(); }));
      panel.addChild(footer);
    }
    if (selectedIndex >= this.page * pageSize && selectedIndex < (this.page + 1) * pageSize) {
      const { loot, count } = entries[selectedIndex]!;
      const index = selectedIndex % pageSize;
      const menuWidth = 184;
      const menuHeight = 144;
      const menu = new Container();
      menu.label = "领取菜单";
      const menuScale = Math.max(0.001, Math.min(1, (width - padding * 2) / menuWidth, (height - padding * 2) / menuHeight));
      menu.scale.set(menuScale);
      menu.position.set(
        Math.max(padding, Math.min(width - menuWidth * menuScale - padding, gridX + (index % grid.columns) * step)),
        Math.max(padding, Math.min(height - menuHeight * menuScale - padding, gridY + Math.floor(index / grid.columns) * step + grid.size + gap)),
      );
      menu.eventMode = "static";
      menu.hitArea = new Rectangle(0, 0, menuWidth, menuHeight);
      menu.on("pointertap", event => event.stopPropagation());
      menu.addChild(new Graphics().roundRect(0, 0, menuWidth, menuHeight, 8)
        .fill(0x14252d).stroke({ color: 0x91b7a5, width: 1 }));
      menu.addChild(this.text(names[loot.kind], 12, 10, 15, loot.rarity === "rare" ? 0xedce85 : 0xb9d9ef));
      menu.addChild(this.text(`${loot.rarity === "rare" ? "稀有" : "魔法"} · Lv.${loot.level} · ×${count}`, 12, 34, 13, 0xa4b1b6));
      menu.addChild(this.button("领一件", 12, 60, 160, 32, canClaim, () => {
        this.closeMenu();
        this.onClaim?.({ ...loot }, 1);
      }));
      menu.addChild(this.button("尽量领", 12, 100, 160, 32, canClaim, () => {
        this.closeMenu();
        this.onClaim?.({ ...loot });
      }));
      panel.addChild(menu);
    }
    this.addChild(panel);
  }
}
