import { Attribute } from "@infinite-build/core";
import type { GameData } from "@infinite-build/core";

export const passiveAffixes: GameData["affixDefinition"]["tablet"]["passive"] =
  {
    roll: {
      levelSpread: 10,
      tier: [1, 10, 20, 30, 40].map((level) => ({ weight: 1, level })),
      countWeight: [0, 1, 1],
    },
    pool: {
      maxHp: {
        tag: ["passive"],
        name: "最大生命值",
        tier: [
          { min: 8, max: 12 },
          { min: 15, max: 25 },
          { min: 30, max: 45 },
          { min: 50, max: 70 },
          { min: 80, max: 100 },
        ],
        apply: (_ctx, param) => ({ attributes: { maxHp: { base: param } } }),
      },
      maxHpPercent: {
        tag: ["passive"],
        name: "最大生命值提高",
        tier: [
          { min: 0.05, max: 0.1 },
          { min: 0.1, max: 0.15 },
          { min: 0.15, max: 0.25 },
          { min: 0.25, max: 0.35 },
          { min: 0.35, max: 0.5 },
        ],
        apply: (_ctx, param) => ({ attributes: { maxHp: { inc: param } } }),
      },
    },
  };

export const supportSkillAffixes: GameData["affixDefinition"]["tablet"]["support"] =
  {
    roll: {
      levelSpread: 15,
      tier: [{ weight: 1, level: 1 }],
      countWeight: [0, 1],
    },
    pool: {
      onUpdateCastRate: {
        tag: ["support-skill"],
        name: "持续施放速率",
        tier: [{ min: 0.5, max: 0.5 }],
        apply: (_ctx, modifier, param) => {
          modifier.attribute = Attribute.mergeDict(modifier.attribute, {
            "skill.onUpdate": { inc: param },
          });
        },
      },
    },
  };
