import type { Tablet } from "./tablet.js";
import type { PlayerCombatProfile } from "../state.js";
import { TabletMap } from "./map.js";
import type { Affix } from "../affix.js";

export namespace SupportTablet {
  export type Apply = (
    ctx: Tablet.Context,
    modifier: Tablet.Modifier,
    param: number,
  ) => void;
  export type Delta = [number, number];
  export type Kind = "skill" | "passive";
}

export class SupportTablet implements Tablet {
  constructor(
    private readonly ctx: Tablet.Context,
    private readonly delta: SupportTablet.Delta[],
    private readonly kind: SupportTablet.Kind,
    private readonly affixes: Affix.Spec[],
  ) {}
  applyModifier(modifiers: Tablet.Modifier[]): void {
    const definitions =
      this.ctx.gameData.affixDefinition.tablet.support[this.kind];
    const affixes = this.affixes.map((affix) => {
      const definition = definitions[affix.id];
      if (!definition) {
        throw new Error(`Unknown ${this.kind} support affix: ${affix.id}`);
      }
      return { apply: definition.apply, param: affix.param };
    });

    for (const [x, y] of this.delta) {
      const id = TabletMap.move(this.ctx.id, x, y, this.ctx.rotate);
      if (id === undefined) continue;
      const modifier = modifiers[id];
      if (modifier === undefined) continue;
      for (const affix of affixes) {
        affix.apply(this.ctx, modifier, affix.param);
      }
    }
  }
  applyPlayer(modifier: Tablet.Modifier, player: PlayerCombatProfile): void {}
}
