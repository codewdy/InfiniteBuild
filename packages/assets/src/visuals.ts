export const effectRenderers = ["projectile", "wave", "target-strike"] as const;
export type EffectRenderer = (typeof effectRenderers)[number];
export type EffectVisual = { renderer: EffectRenderer; frames: string };
export type SkillIcon = {
  icon: string;
  rarityIcons?: Record<string, string>;
};
export type AffixVisual = { icon?: string; category?: string };
export type VisualMappings = {
  skillIcons: Record<string, SkillIcon>;
  defaultSkillIcon: string;
  affixVisuals: Record<string, AffixVisual>;
  affixCategories: Record<string, string>;
  defaultAffixIcon: string;
};

export function resolveSkillIcon(
  visuals: VisualMappings,
  skill: string,
  rarity = "normal",
): string {
  const visual = visuals.skillIcons[skill];
  return (
    visual?.rarityIcons?.[rarity] ?? visual?.icon ?? visuals.defaultSkillIcon
  );
}

/** Dedicated frame, category frame, then the explicitly configured generic frame. */
export function resolveAffixFrame(
  visuals: VisualMappings,
  affix?: string,
): string {
  const visual = affix ? visuals.affixVisuals[affix] : undefined;
  return (
    visual?.icon ??
    (visual?.category ? visuals.affixCategories[visual.category] : undefined) ??
    visuals.defaultAffixIcon
  );
}
