import { Container, type Text } from "pixi.js";
import type { BattleEvent } from "@infinite-build/core";
import { REFERENCE_HEIGHT, UNIT_SIZE_FACTOR, unitY } from "./layout.js";
import { createText } from "./text.js";

type Damage = { text: Text; position: number; y: number; start: number };

/** Labels stay at the impact position independently of the target's animation. */
export class BattleDamageText extends Container {
  private damage: Damage[] = [];

  reset(): void {
    for (const entry of this.damage) entry.text.destroy();
    this.damage = [];
  }

  addDamage(
    event: BattleEvent.Damage,
    position: number,
    kind: string,
    now: number,
  ): void {
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
      y: unitY(event.dst, kind, 1),
      start: now,
    });
  }

  draw(x: (position: number) => number, height: number, now: number): void {
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
        entry.y * height - (45 + t * 30) * scale,
      );
      entry.text.alpha = Math.min(1, (1 - t) * 3);
      return true;
    });
  }
}
