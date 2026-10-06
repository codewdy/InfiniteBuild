import { Attribute } from "@infinite-build/core";
import type { GameData } from "@infinite-build/core";

export const passiveAffixes: GameData["affixDefinition"]["tablet"]["passive"] = {
  maxHp: {
    name: "最大生命值",
    tier: [{ min: 10, max: 10 }],
    apply: (_ctx, param) => ({ attributes: { maxHp: { base: param } } }),
  },
};

export const supportSkillAffixes: GameData["affixDefinition"]["tablet"]["support"]["skill"] = {
  onUpdateCastRate: {
    name: "持续施放速率",
    tier: [{ min: 0.5, max: 0.5 }],
    apply: (_ctx, modifier, param) => {
      modifier.attribute = Attribute.mergeDict(modifier.attribute, {
        "skill.onUpdate": { inc: param },
      });
    },
  },
};
