import { Attribute } from "../../battle/combat/attribute.js";
import { SkillTrigger } from "../../battle/combat/skill-trigger.js";
import type { UnitSkill } from "../../battle/combat/skill-trigger.js";
import type { PlayerStatus } from "../build.js";
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
    modifiers[id] = Attribute.mergeDict(modifiers[id]!, {
      ["skill.onUpdate"]: { base: 1 },
    });
  }
  applyPlayer(
    tablets: (Tablet | undefined)[],
    modifier: Tablet.Modifier,
    player: PlayerStatus,
  ): void {
    for (const type of SkillTrigger.eventTypes) {
      const multiplier = Attribute.resolve(modifier[`skill.${type}`]);
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
