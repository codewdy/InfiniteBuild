import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import type { SkillDefinition, UnitDefinition } from "@infinite-build/core";
import type { CharacterTextures } from "./battlefield-assets.js";

const triggerNames: Record<string, string> = {
  onUpdate: "自动施放", onDamageDealt: "造成伤害时", onDamageReceived: "受到伤害时",
  onHitDealt: "命中时", onHitReceived: "被命中时", onHeal: "治疗时",
  onKill: "击杀时", onDeath: "死亡时",
};

/** A sliding definition drawer, independent of the selected unit's combat state. */
export class MonsterInfo extends Container {
  private readonly backdrop = new Graphics();
  private readonly panel = new Container();
  private panelHeight = 220;
  private readonly panelWidth = 300;
  private panelBackground?: Graphics;
  private opening = false;
  private openAmount = 0;
  private animatedAt = 0;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = "static";
    this.backdrop.eventMode = "static";
    this.backdrop.on("pointertap", () => this.hide());
    this.panel.eventMode = "static";
    this.panel.on("pointertap", event => event.stopPropagation());
    this.addChild(this.backdrop, this.panel);
  }

  hide(immediate = false): void {
    this.opening = false;
    this.animatedAt = performance.now();
    if (immediate) {
      this.openAmount = 0;
      this.visible = false;
    }
  }

  show(definition: UnitDefinition, poses: CharacterTextures | undefined,
    skills: Readonly<Record<string, SkillDefinition>>): void {
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const background = new Graphics();
    this.panelBackground = background;
    this.panel.addChild(background);
    const label = (value: string, size: number, color: number, x: number, y: number, width: number) => {
      const text = new Text({ text: value, style: {
        fontFamily: "system-ui, sans-serif", fontSize: size, fill: color,
        wordWrap: true, breakWords: true, wordWrapWidth: width,
      } });
      text.position.set(x, y);
      this.panel.addChild(text);
      return text;
    };
    this.panel.addChild(new Graphics().roundRect(16, 18, 68, 74, 6)
      .fill(0x172d36).stroke({ color: 0x516e77, width: 1 }));
    const texture = poses?.animations.idle.frames[0];
    if (texture) {
      const portrait = new Sprite({ texture, roundPixels: true });
      portrait.anchor.set(0.5);
      portrait.scale.set(Math.min(60 / texture.orig.width, 66 / texture.orig.height));
      portrait.position.set(50, 55);
      this.panel.addChild(portrait);
    } else {
      label("?", 28, 0x91c8cb, 40, 35, 40);
    }
    label(definition.name, 18, 0xe7f8f4, 96, 20, 158);
    const attributes = definition.status.attributes;
    label(`基础血量  ${attributes?.maxHp ?? 0}\n基础攻击力  ${attributes?.attack ?? 0}`,
      13, 0xb8cbd6, 96, 51, 182);
    const close = label("×", 23, 0xb8cbd6, 269, 7, 24);
    close.eventMode = "static";
    close.cursor = "pointer";
    close.hitArea = new Rectangle(-5, -3, 30, 30);
    close.on("pointertap", event => { event.stopPropagation(); this.hide(); });
    label("技能", 14, 0x83d8ca, 16, 106, 268);
    let y = 132;
    let count = 0;
    for (const [trigger, entries] of Object.entries(definition.skills)) {
      for (const entry of entries ?? []) {
        const skill = skills[entry.skill];
        const title = label(`${skill?.name ?? entry.skill} · ${triggerNames[trigger] ?? trigger}`,
          13, 0xe7f8f4, 16, y, 268);
        y += title.height + 4;
        const description = label(skill?.description(entry.params) ?? "暂无技能描述",
          12, 0xb8cbd6, 16, y, 268);
        y += description.height + 14;
        count++;
      }
    }
    if (!count) y += label("无技能", 12, 0xb8cbd6, 16, y, 268).height + 14;
    this.panelHeight = y + 6;
    if (!this.visible) this.openAmount = 0;
    this.opening = true;
    this.animatedAt = performance.now();
    this.visible = true;
  }

  layout(width: number, height: number): void {
    if (!this.visible) return;
    const now = performance.now();
    const step = Math.max(0, now - this.animatedAt) / 220;
    this.animatedAt = now;
    this.openAmount = Math.max(0, Math.min(1, this.openAmount + (this.opening ? step : -step)));
    if (!this.opening && this.openAmount === 0) {
      this.visible = false;
      return;
    }
    const progress = this.openAmount * this.openAmount * (3 - 2 * this.openAmount);
    this.backdrop.clear().rect(0, 0, width, height).fill({ color: 0x000810, alpha: 0.45 * progress });
    this.backdrop.hitArea = new Rectangle(0, 0, width, height);
    const scale = Math.min(1.5, width * 0.85 / this.panelWidth, height * 0.92 / this.panelHeight);
    this.panel.scale.set(scale);
    const drawerHeight = height / scale;
    this.panelBackground!.clear()
      .rect(0, 0, this.panelWidth, drawerHeight).fill({ color: 0x10202e, alpha: 0.98 })
      .moveTo(0, 0).lineTo(0, drawerHeight).stroke({ color: 0x9b906b, width: 2 });
    this.panel.hitArea = new Rectangle(0, 0, this.panelWidth, drawerHeight);
    this.panel.position.set(width - this.panelWidth * scale * progress, 0);
  }
}
