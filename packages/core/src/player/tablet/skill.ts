import { Attribute } from "../../battle/combat/attribute.js";
import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { UnitSkill } from "../../battle/combat/skill-trigger.js";
import type { PlayerCombatProfile } from "../state.js";
import type { Tablet } from "./tablet.js";

export class SkillTablet implements Tablet {
  constructor(
    private readonly ctx: Tablet.Context,
    private readonly uuid: string,
    private readonly skill: UnitSkill,
  ) {}
  applyModifier(modifiers: Tablet.Modifier[]): void {
    const modifier = modifiers[this.ctx.id]!;
    modifier.attribute = Attribute.mergeDict(modifier.attribute, {
      ["skill.onUpdate"]: { base: 1 },
    });
  }
  applyPlayer(modifier: Tablet.Modifier, player: PlayerCombatProfile): void {
    for (const type of SkillTrigger.eventTypes) {
      const multiplier = Attribute.resolve(modifier.attribute[`skill.${type}`]);
      if (multiplier < 1e-6) continue;
      const skill: UnitSkill = {
        ...structuredClone(this.skill),
        uuid: `${this.uuid}:${type}`,
        castRate: (this.skill.castRate ?? 1) * multiplier,
      };
      (player.skills[type] ??= []).push(skill);
    }
  }
}
