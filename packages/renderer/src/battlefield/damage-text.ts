import type { Position } from "@infinite-build/core";
import { Container, type Text } from "pixi.js";
import type { BattleEvent } from "@infinite-build/core";
import { REFERENCE_HEIGHT, UNIT_SIZE_FACTOR } from "./layout.js";
import { createText } from "./text.js";

type Damage = { text: Text; position: Position; start: number };

/** Labels stay at the impact position independently of the target's animation. */
export class BattleDamageText extends Container {
  private damage: Damage[] = [];

  reset(): void {
    for (const entry of this.damage) entry.text.destroy();
    this.damage = [];
  }

  addDamage(event: BattleEvent.Damage, position: Position, now: number): void {
    const text = createText(
      `−${Number(event.damage.toFixed(2))}`,
      15,
      0xffa1a6,
    );
    text.style.fontWeight = "bold";
    text.anchor.set(0.5);
    this.addChild(text);
    this.damage.push({
      text,
      position,
      start: now,
    });
  }

  draw(
    x: (position: Position) => number,
    y: (position: Position) => number,
    height: number,
    now: number,
  ): void {
    const scale = (height / REFERENCE_HEIGHT) * UNIT_SIZE_FACTOR;
    this.damage = this.damage.filter((entry) => {
      const t = (now - entry.start) / 850;
      if (t >= 1) {
        entry.text.destroy();
        return false;
      }
      entry.text.scale.set(scale);
      entry.text.position.set(
        x(entry.position),
        y(entry.position) - (45 + t * 30) * scale,
      );
      entry.text.alpha = Math.min(1, (1 - t) * 3);
      return true;
    });
  }
}
