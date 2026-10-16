import { Position } from "@infinite-build/core";
import { Container } from "pixi.js";
import type { BattlefieldAssets } from "@infinite-build/assets";
import type { BattleEvent, BattleLog } from "@infinite-build/core";
import { createSkillEffect } from "../effects/index.js";
import type { SkillEffect } from "../effects/index.js";
import type { BattlefieldUnits } from "./units.js";
import { REFERENCE_HEIGHT, UNIT_SIZE_FACTOR } from "./layout.js";

export class BattleSkillEffects extends Container {
  private activeEffects: SkillEffect[] = [];
  constructor(
    private readonly assets: BattlefieldAssets,
    private readonly units: BattlefieldUnits,
    private readonly getHeight: () => number,
  ) {
    super();
  }

  private get unitScale(): number {
    return (this.getHeight() / REFERENCE_HEIGHT) * UNIT_SIZE_FACTOR;
  }

  reset(): void {
    for (const effect of this.activeEffects) effect.sprite.destroy();
    this.activeEffects = [];
  }

  update(log: BattleLog): void {
    this.activeEffects = this.activeEffects.filter((effect) => {
      if (log.frame - effect.start < effect.duration) return true;
      effect.sprite.destroy();
      return false;
    });
  }

  playEffect(
    event: BattleEvent.Effect,
    log: BattleLog,
    previous?: BattleLog,
  ): void {
    const effects = this;
    const effect = createSkillEffect(event, {
      assets: this.assets,
      log,
      previous,
      get unitScale() {
        return effects.unitScale;
      },
    });
    if (!effect) return;
    this.addChild(effect.sprite);
    this.activeEffects.push(effect);
  }

  draw(
    log: BattleLog,
    effectFrame: number,
    progress: number,
    x: (position: Position) => number,
    y: (position: Position) => number,
  ): void {
    const activeUnitIds = new Set(log.units.map((unit) => unit.id));
    this.activeEffects = this.activeEffects.filter((effect) => {
      const elapsedFrames = Math.max(0, effectFrame - effect.start);
      const t = Math.min(1, elapsedFrames / effect.duration);
      if (t >= 1) {
        effect.sprite.destroy();
        return false;
      }
      const finished = effect.update(t, {
        elapsedFrames,
        x,
        y,
        targetPosition: (id) => {
          const target = this.units.get(id);
          return target && activeUnitIds.has(id)
            ? Position.lerp(target.from, target.position, progress)
            : undefined;
        },
      });
      if (finished) effect.sprite.destroy();
      return !finished;
    });
  }
}
