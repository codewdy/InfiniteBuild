import { Attribute, derivePlayerCombatProfile } from "@infinite-build/core";
import type { BattleLog, GameData, PlayerState } from "@infinite-build/core";
import type { Texture } from "pixi.js";
import { Container, Graphics, Point, Rectangle, Sprite, Text } from "pixi.js";

const PLAYER_DRAWER_HANDLE_HEIGHT = 36;

function label(size: number, color = 0xe7f8f4): Text {
  return new Text({ text: "", resolution: 2, style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill: color } });
}

/** Local presentation state only; opening the sheet never changes game state. */
export class PlayerDrawerView extends Container {
  private readonly shade = new Graphics();
  private readonly clip = new Graphics();
  private readonly sheet = new Container();
  private readonly background = new Graphics();
  private readonly handle = new Container();
  private readonly handleArt: Sprite;
  private readonly handleArrow = new Graphics();
  private readonly body = new Container();
  private readonly level = label(24, 0xffe5a6);
  private readonly experience = label(14, 0xb8cbd6);
  private readonly xpBar = new Graphics();
  private readonly cells: Text[] = [];
  private readonly progressLabel = label(14, 0xb8cbd6);
  private readonly autoAdvanceLabel = label(14, 0xb8cbd6);
  private stateKey = "";
  private attributes = { maxHp: 0, attack: 0, defense: 0 };
  private viewWidth = 1;
  private viewHeight = 1;
  private sheetHeight = 1;
  private open = false;
  private progress = 0;
  private animationFrom = 0;
  private animationStart = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly data: GameData, handleTexture: Texture, private readonly onInteract: () => void) {
    super();
    this.handleArt = new Sprite(handleTexture);
    this.handleArt.anchor.set(0.5, 1);
    this.eventMode = "passive";
    this.shade.eventMode = "static";
    this.shade.on("pointertap", event => { event.stopPropagation(); this.close(); });
    this.sheet.eventMode = "static";
    this.sheet.on("pointertap", event => event.stopPropagation());
    this.handle.eventMode = "static";
    this.handle.cursor = "pointer";
    this.handle.on("pointertap", event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      this.onInteract();
      this.setOpen(!this.open);
    });
    this.handle.addChild(this.handleArt, this.handleArrow);
    this.sheet.addChild(this.background, this.body, this.handle);
    this.body.eventMode = "none";
    this.body.addChild(this.level, this.experience, this.xpBar);
    this.level.position.set(0, 0);
    this.experience.position.set(0, 38);
    const names = ["生命", "攻击", "防御", "移动速度", "背包", "已装备石板"];
    names.forEach((name, index) => {
      const x = (index % 2) * 248;
      const y = 90 + Math.floor(index / 2) * 62;
      this.body.addChild(new Graphics().roundRect(x, y, 232, 54, 8).fill(0x1a343e)
        .stroke({ color: 0x395761, width: 1 }));
      const heading = label(12, 0x9bb8ba);
      heading.text = name;
      heading.position.set(x + 12, y + 6);
      const value = label(20);
      value.position.set(x + 12, y + 24);
      this.body.addChild(heading, value);
      this.cells.push(value);
    });
    this.progressLabel.position.set(0, 286);
    this.autoAdvanceLabel.position.set(0, 312);
    this.body.addChild(this.progressLabel, this.autoAdvanceLabel);
    this.addChild(this.shade, this.sheet, this.clip);
    this.mask = this.clip;
    this.onRender = () => {
      const target = this.open ? 1 : 0;
      if (this.progress === target) return;
      const elapsed = Math.min(1, (performance.now() - this.animationStart) / 220);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      this.progress = elapsed === 1 ? target : this.animationFrom + (target - this.animationFrom) * eased;
      this.positionSheet();
    };
  }

  get expanded(): boolean { return this.open || this.progress > 0; }

  close(): void {
    this.setOpen(false);
  }

  blocksPointer(event: MouseEvent): boolean {
    const point = this.pointer(event);
    return point.x >= 0 && point.x <= this.viewWidth && point.y >= 0 && point.y <= this.viewHeight &&
      (this.expanded || (Math.abs(point.x - this.viewWidth / 2) <= 36 && point.y >= this.viewHeight - PLAYER_DRAWER_HANDLE_HEIGHT));
  }

  update(state: PlayerState, log: BattleLog): void {
    const key = JSON.stringify(state);
    if (key !== this.stateKey) {
      this.stateKey = key;
      const profile = derivePlayerCombatProfile(this.data, state);
      this.attributes = Attribute.resolveDict(profile.status.attributes);
      this.level.text = `玩家  ·  Lv.${state.level}`;
      const thresholds = this.data.playerDefinition.levelXP;
      const previous = thresholds[state.level - 1] ?? 0;
      const next = thresholds[state.level];
      this.experience.text = next === undefined ? `累计经验 ${state.xp}  ·  已达最高等级` : `经验 ${state.xp - previous} / ${next - previous}  ·  累计 ${state.xp}`;
      const ratio = next === undefined ? 1 : Math.max(0, Math.min(1, (state.xp - previous) / (next - previous)));
      this.xpBar.clear().roundRect(0, 65, 480, 8, 4).fill(0x28434c);
      if (ratio > 0) this.xpBar.roundRect(0, 65, Math.max(8, 480 * ratio), 8, 4).fill(0x82e6ce);
      this.cells[3]!.text = this.number(profile.move.speed);
      this.cells[4]!.text = `${state.inventory.filter(Boolean).length} / ${this.data.playerDefinition.inventoryCapacity}`;
      this.cells[5]!.text = `${state.tablets.filter(Boolean).length} / ${state.tablets.length}`;
      this.progressLabel.text = `当前关卡 ${state.currentMapLevel.join("-")}   ·   最高解锁 ${state.highestUnlockedMapLevel.join("-")}`;
      this.autoAdvanceLabel.text = `自动推进关卡：${state.config.autoAdvanceLevel ? "开启" : "关闭"}`;
    }
    const player = log.units.find(unit => unit.kind === "Player");
    const attributes = player?.status.attributes ?? this.attributes;
    this.cells[0]!.text = `${this.number(player?.hp ?? 0)} / ${this.number(attributes.maxHp)}`;
    this.cells[1]!.text = this.number(attributes.attack);
    this.cells[2]!.text = this.number(attributes.defense);
  }

  layout(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.sheetHeight = Math.min(420, Math.max(PLAYER_DRAWER_HANDLE_HEIGHT + 1, height - 8));
    this.shade.clear().rect(0, 0, width, height).fill(0x000000);
    this.clip.clear().rect(0, 0, width, height).fill(0xffffff);
    this.background.clear().roundRect(0, PLAYER_DRAWER_HANDLE_HEIGHT, width, this.sheetHeight - PLAYER_DRAWER_HANDLE_HEIGHT + 12, 14)
      .fill({ color: 0x10252d, alpha: 0.98 }).stroke({ color: 0x51767a, width: 1 });
    this.sheet.hitArea = new Rectangle(0, 0, width, this.sheetHeight);
    this.handle.hitArea = new Rectangle(width / 2 - 36, 0, 72, PLAYER_DRAWER_HANDLE_HEIGHT);
    const scale = Math.max(0.001, Math.min(1, (width - 32) / 480, (this.sheetHeight - PLAYER_DRAWER_HANDLE_HEIGHT - 24) / 340));
    this.body.scale.set(scale);
    this.body.position.set((width - 480 * scale) / 2, PLAYER_DRAWER_HANDLE_HEIGHT + 12);
    this.positionSheet();
    this.updateHandleArt();
  }

  private setOpen(open: boolean): void {
    if (this.open === open) return;
    this.animationFrom = this.progress;
    this.animationStart = performance.now();
    this.open = open;
    this.updateHandleArt();
  }

  private number(value: number): string { return Number(value.toFixed(1)).toString(); }

  private updateHandleArt(): void {
    const x = this.viewWidth / 2;
    const y = PLAYER_DRAWER_HANDLE_HEIGHT - 8;
    const direction = this.open ? 1 : -1;
    this.handleArt.position.set(x, PLAYER_DRAWER_HANDLE_HEIGHT);
    this.handleArt.width = 72;
    this.handleArt.height = 16;
    this.handleArrow.clear()
      .moveTo(x - 6, y - direction * 2)
      .lineTo(x, y + direction * 2)
      .lineTo(x + 6, y - direction * 2)
      .stroke({ color: 0xffe5a6, width: 2, cap: "round", join: "round" });
  }

  private positionSheet(): void {
    this.sheet.y = this.viewHeight - PLAYER_DRAWER_HANDLE_HEIGHT - this.progress * (this.sheetHeight - PLAYER_DRAWER_HANDLE_HEIGHT);
    this.sheet.eventMode = this.progress > 0 ? "static" : "passive";
    this.shade.visible = this.progress > 0;
    this.shade.alpha = this.progress * 0.45;
    this.body.visible = this.progress > 0;
  }

  private pointer(event: MouseEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return this.toLocal(new Point((event.clientX - bounds.left) * this.canvas.clientWidth / bounds.width,
      (event.clientY - bounds.top) * this.canvas.clientHeight / bounds.height));
  }

  override destroy(): void {
    super.destroy({ children: true });
  }
}
