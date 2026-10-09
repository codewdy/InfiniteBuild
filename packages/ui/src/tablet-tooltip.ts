import { Container, Graphics, Text } from "pixi.js";
import { Rectangle } from "pixi.js";
import { TabletMap, TabletSpec } from "@infinite-build/core";
import type { GameData } from "@infinite-build/core";

export type TabletTooltip = {
  title: string;
  subtitle?: string;
  lines: readonly string[];
  supportTargets?: readonly (readonly [number, number])[];
};

/** UI owns the presentation text; the host supplies only game definitions. */
export function describeTablet(
  tablet: TabletSpec.Tablet,
  gameData: GameData,
  area: "tablets" | "inventory",
): TabletTooltip {
  const lines: string[] = [];
  let title: string;
  if (tablet.kind === "tablet-skill") {
    const definition = gameData.skillDefinitions[tablet.skill];
    const skill = gameData.playerDefinition.skills[tablet.skill];
    title = definition?.name ?? tablet.skill;
    if (definition && skill) {
      lines.push(definition.description(skill.params));
      if (
        skill.castRate !== undefined &&
        Number.isFinite(skill.castRate) &&
        skill.castRate > 0
      ) {
        lines.push(`每 ${Number((1 / skill.castRate).toFixed(2))} 帧施放`);
      }
    }
  } else {
    title =
      tablet.kind === "tablet-passive"
        ? "被动石板"
        : tablet.kind === "tablet-support-skill"
          ? "技能辅助石板"
          : "被动辅助石板";
  }
  const definitions =
    tablet.kind === "tablet-passive"
      ? gameData.affixDefinition.tablet.passive.pool
      : gameData.affixDefinition.tablet.support.pool;
  for (const affix of tablet.affixes) {
    const description =
      definitions[affix.id]?.description(affix.param) ??
      `${affix.id}: ${affix.param}`;
    lines.push(`${description} · T${affix.tier + 1}`);
  }
  return {
    title,
    subtitle: area === "inventory" ? "置于石板盘以装备" : "已装备",
    lines,
    supportTargets:
      "rotate" in tablet
        ? TabletSpec.getSupportDelta(gameData, tablet).map(([x, y]) =>
            TabletMap.rotateVec(x, y, tablet.rotate),
          )
        : undefined,
  };
}

/** Tooltip stays in viewport coordinates; support tablets expose a rotation action. */
export class TabletTooltipView extends Container {
  private readonly background = new Graphics();
  private readonly legend = new Graphics();
  private readonly supportRow = new Container();
  private readonly rotateButton = new Container();
  private readonly rotateLabel = new Text({
    text: "旋转(右键)",
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 12,
      fill: 0xe6edf7,
    },
  });
  private onRotate?: () => void;
  private readonly heading = new Text({
    text: "",
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 16,
      fontWeight: "bold",
      fill: 0xe6edf7,
      wordWrap: true,
      breakWords: true,
    },
  });
  private readonly subtitle = new Text({
    text: "",
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 11,
      fill: 0x92a3b9,
      wordWrap: true,
      breakWords: true,
    },
  });
  private readonly body = new Text({
    text: "",
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 13,
      lineHeight: 21,
      fill: 0xc1cfdf,
      wordWrap: true,
      breakWords: true,
    },
  });

  constructor() {
    super();
    this.eventMode = "static";
    this.visible = false;
    this.rotateButton.addChild(
      new Graphics()
        .roundRect(0, 0, 112, 30, 6)
        .fill(0x24384b)
        .stroke({ color: 0x6c9ab9, width: 1 }),
    );
    this.rotateLabel.anchor.set(0.5);
    this.rotateLabel.position.set(56, 15);
    this.rotateButton.addChild(this.rotateLabel);
    this.rotateButton.cursor = "pointer";
    this.rotateButton.on("pointertap", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      this.onRotate?.();
    });
    this.supportRow.addChild(this.legend, this.rotateButton);
    this.addChild(
      this.background,
      this.heading,
      this.subtitle,
      this.body,
      this.supportRow,
    );
  }

  show(
    content: TabletTooltip,
    anchor: Rectangle,
    viewportWidth: number,
    viewportHeight: number,
    rare: boolean,
    onRotate?: () => void,
  ): void {
    const margin = 8;
    const padding = 14;
    const width = Math.max(32, Math.min(300, viewportWidth - margin * 2));
    this.scale.set(1);
    this.heading.text = content.title;
    this.heading.style.fill = rare ? 0xffc45e : 0x79b8ff;
    this.heading.style.wordWrapWidth =
      this.subtitle.style.wordWrapWidth =
      this.body.style.wordWrapWidth =
        Math.max(1, width - padding * 2);
    this.onRotate = onRotate;
    this.rotateButton.visible = content.supportTargets !== undefined;
    this.rotateButton.eventMode = onRotate ? "static" : "none";
    this.rotateButton.alpha = onRotate ? 1 : 0.45;
    const headingY = padding;
    this.heading.position.set(padding, headingY);
    this.subtitle.text = content.subtitle ?? "";
    this.subtitle.visible = !!content.subtitle;
    this.subtitle.position.set(padding, headingY + this.heading.height + 4);
    this.body.text = content.lines.join("\n");
    const descriptionY = this.subtitle.visible
      ? this.subtitle.y + this.subtitle.height + 9
      : headingY + this.heading.height + 9;
    this.body.position.set(padding, descriptionY);
    let contentBottom = this.body.y + this.body.height;
    this.supportRow.visible = this.legend.visible =
      content.supportTargets !== undefined;
    this.legend.clear();
    if (content.supportTargets) {
      const size = this.drawSupportLegend(
        content.supportTargets,
        Math.max(1, width - padding * 2),
      );
      const rowWidth = size + 14 + 112;
      const rowHeight = Math.max(size, 30);
      const rowScale = Math.min(1, Math.max(1, width - padding * 2) / rowWidth);
      this.supportRow.scale.set(rowScale);
      this.supportRow.position.set(
        (width - rowWidth * rowScale) / 2,
        contentBottom + 12,
      );
      this.legend.position.set(0, (rowHeight - size) / 2);
      this.rotateButton.position.set(size + 14, (rowHeight - 30) / 2);
      contentBottom = this.supportRow.y + rowHeight * rowScale;
    }
    const height = contentBottom + padding;
    this.hitArea = new Rectangle(0, 0, width, height);
    this.background
      .clear()
      .roundRect(0, 0, width, height, 9)
      .fill({ color: 0x0c1420, alpha: 0.65 })
      .stroke({ color: rare ? 0xbfa278 : 0x577fa3, width: 1 });
    const scale = Math.max(
      0.001,
      Math.min(1, (viewportHeight - margin * 2) / height),
    );
    this.scale.set(scale);
    const displayWidth = width * scale;
    const displayHeight = height * scale;
    let x = anchor.right + 10;
    if (x + displayWidth > viewportWidth - margin)
      x = anchor.left - displayWidth - 10;
    this.position.set(
      Math.max(margin, Math.min(x, viewportWidth - displayWidth - margin)),
      Math.max(
        margin,
        Math.min(anchor.top, viewportHeight - displayHeight - margin),
      ),
    );
    this.visible = true;
  }

  private drawSupportLegend(
    targets: readonly (readonly [number, number])[],
    maxWidth: number,
  ): number {
    const radius = Math.max(
      1,
      ...targets.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]),
    );
    const cells = radius * 2 + 1;
    const cell = Math.min(26, Math.min(156, maxWidth) / cells);
    const size = cells * cell;
    const gap = Math.min(3, cell * 0.12);
    const center = size / 2;
    const originColor = 0x79b8ff;
    const targetColor = 0x82e6ce;
    const active = new Set(targets.map(([x, y]) => `${x},${y}`));
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const isOrigin = x === 0 && y === 0;
        const isTarget = active.has(`${x},${y}`);
        this.legend
          .roundRect(
            (x + radius) * cell + gap / 2,
            (y + radius) * cell + gap / 2,
            cell - gap,
            cell - gap,
            Math.min(3, cell / 6),
          )
          .fill({
            color: isOrigin ? 0x234361 : isTarget ? 0x1d493f : 0x172332,
            alpha: 0.9,
          })
          .stroke({
            color: isOrigin ? originColor : isTarget ? targetColor : 0x35465a,
            width: 1,
          });
      }
    }
    for (const [x, y] of targets) {
      const distance = Math.hypot(x, y);
      if (distance === 0) continue;
      const dx = x / distance;
      const dy = y / distance;
      const tipX = center + x * cell - dx * cell * 0.2;
      const tipY = center + y * cell - dy * cell * 0.2;
      const head = cell * 0.2;
      this.legend
        .moveTo(center + dx * cell * 0.3, center + dy * cell * 0.3)
        .lineTo(tipX, tipY)
        .moveTo(
          tipX - dx * head - dy * head * 0.65,
          tipY - dy * head + dx * head * 0.65,
        )
        .lineTo(tipX, tipY)
        .lineTo(
          tipX - dx * head + dy * head * 0.65,
          tipY - dy * head - dx * head * 0.65,
        )
        .stroke({ color: targetColor, width: Math.min(1.5, cell * 0.08) });
    }
    const diamond = cell * 0.13;
    this.legend
      .moveTo(center, center - diamond)
      .lineTo(center + diamond, center)
      .lineTo(center, center + diamond)
      .lineTo(center - diamond, center)
      .closePath()
      .fill(originColor);
    return size;
  }

  hide(): void {
    this.visible = false;
    this.onRotate = undefined;
  }
}
