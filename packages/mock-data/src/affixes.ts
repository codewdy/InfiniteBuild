import { Attribute } from "@infinite-build/core";
import type { GameData } from "@infinite-build/core";

function formatValue(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

export const passiveAffixes: GameData["affixDefinition"]["tablet"]["passive"] =
  {
    roll: {
      levelSpread: 10,
      tier: [1, 10, 20, 30, 40].map((level) => ({ weight: 1, level })),
      countWeight: [0, 1, 1],
    },
    pool: {
      attack: {
        tag: ["tablet-passive"],
        name: "攻击力",
        description: (param) => `攻击力 +${formatValue(param)}`,
        tier: [
          { min: 2, max: 4 },
          { min: 5, max: 8 },
          { min: 10, max: 15 },
          { min: 18, max: 25 },
          { min: 30, max: 40 },
        ],
        apply: (_ctx, param) => ({ attributes: { attack: { base: param } } }),
      },
      attackPercent: {
        tag: ["tablet-passive"],
        name: "攻击力提升",
        description: (param) =>
          `攻击力提升(add) ${formatValue(param * 100)}%`,
        tier: [
          { min: 0.05, max: 0.1 },
          { min: 0.1, max: 0.15 },
          { min: 0.15, max: 0.25 },
          { min: 0.25, max: 0.35 },
          { min: 0.35, max: 0.5 },
        ],
        apply: (_ctx, param) => ({ attributes: { attack: { inc: param } } }),
      },
      maxHp: {
        tag: ["tablet-passive"],
        name: "最大生命值",
        description: (param) => `最大生命值 +${formatValue(param)}`,
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
        tag: ["tablet-passive"],
        name: "最大生命值提升",
        description: (param) =>
          `最大生命值提升(add) ${formatValue(param * 100)}%`,
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
        tag: ["tablet-support-skill"],
        name: "持续施放速率",
        description: (param) =>
          `持续施放速率提升(add) ${formatValue(param * 100)}%`,
        tier: [{ min: 0.5, max: 0.5 }],
        apply: (_ctx, modifier, param) => {
          modifier.attribute = Attribute.mergeDict(modifier.attribute, {
            "skill.onUpdate": { inc: param },
          });
        },
      },
    },
  };
