import { Attribute } from "../../battle/combat/attribute.js";
import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { UnitSkill } from "../../battle/combat/skill-trigger.js";
import type { PlayerCombatProfile } from "../state.js";
import type { Tablet } from "./tablet.js";

export class SkillTablet implements Tablet {
  constructor(
    private readonly uuid: string,
    private readonly skill: UnitSkill,
  ) {}
  applyModifier(
    tablets: (Tablet | undefined)[],
    modifiers: Tablet.Modifier[],
    id: number,
  ): void {
    const modifier = modifiers[id]!;
    modifier.attribute = Attribute.mergeDict(modifier.attribute, {
      ["skill.onUpdate"]: { base: 1 },
    });
  }
  applyPlayer(
    tablets: (Tablet | undefined)[],
    modifier: Tablet.Modifier,
    player: PlayerCombatProfile,
  ): void {
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
