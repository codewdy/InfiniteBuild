import type { Tablet } from "./tablet.js";
import type { Affix } from "../affix.js";
import type { PlayerCombatProfile } from "../state.js";
import { Status } from "../../battle/combat/status.js";
import { Attribute } from "../../battle/combat/attribute.js";

export namespace PassiveTablet {
  export type Apply = (ctx: Tablet.Context, param: number) => Status.Modifier;
}

export class PassiveTablet implements Tablet {
  constructor(
    private readonly ctx: Tablet.Context,
    private readonly affixes: Affix.Spec[],
  ) {}
  applyModifier(modifiers: Tablet.Modifier[]): void {}
  applyPlayer(modifier: Tablet.Modifier, player: PlayerCombatProfile): void {
    const definitions = this.ctx.gameData.affixDefinition.tablet.passive;
    const statuses = this.affixes.map((affix) => {
      const definition = definitions.pool[affix.id];
      if (!definition) {
        throw new Error(`Unknown passive affix: ${affix.id}`);
      }
      return definition.apply(this.ctx, affix.param);
    });
    player.status = Status.apply(player.status, statuses);
  }
}
