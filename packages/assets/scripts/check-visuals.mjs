/** Cross-check content IDs and visual mappings without coupling core to Pixi. */
export function checkVisuals(manifest, { skills, affixes, renderers }) {
  const errors = [];
  const warnings = [];
  const icons = manifest.icons ?? {};
  const frames = manifest.frames ?? {};
  const skillIcons = manifest.skillIcons ?? {};
  const affixVisuals = manifest.affixVisuals ?? {};
  const categories = manifest.affixCategories ?? {};
  const effects = manifest.effectVisuals ?? {};
  const has = (record, key) =>
    typeof key === "string" && Object.hasOwn(record, key);
  const icon = (id, context) => {
    if (!has(icons, id) || !has(frames, icons[id]))
      errors.push(`${context}: missing icon ${id}`);
  };
  const frame = (id, context) => {
    if (!has(frames, id)) errors.push(`${context}: missing frame ${id}`);
  };
  icon(manifest.defaultSkillIcon, "defaultSkillIcon");
  frame(manifest.defaultAffixIcon, "defaultAffixIcon");
  for (const [id, visual] of Object.entries(skillIcons)) {
    icon(visual.icon, `skill ${id}`);
    if (visual.background !== undefined)
      icon(visual.background, `skill ${id} background`);
    for (const value of Object.values(visual.rarityIcons ?? {}))
      icon(value, `skill ${id} rarity`);
    if (!skills.includes(id))
      warnings.push(`Visual mapping for unknown skill: ${id}`);
  }
  for (const id of skills)
    if (!has(skillIcons, id))
      errors.push(
        `Missing skill icon: ${id}; configure an icon or explicitly use the generic icon`,
      );
  for (const [id, animation] of Object.entries(manifest.castAnimations ?? {})) {
    if (!["cast", "attack"].includes(animation))
      errors.push(`skill ${id}: invalid cast animation`);
    if (!skills.includes(id))
      warnings.push(`Cast animation for unknown skill: ${id}`);
  }
  for (const [id, effect] of Object.entries(effects)) {
    if (!renderers.includes(effect.renderer))
      errors.push(`effect ${id}: unknown renderer ${effect.renderer}`);
    if (effect.renderer === "lightning") continue;
    const sequence = manifest.effects?.[effect.frames];
    if (!Array.isArray(sequence) || !sequence.length)
      errors.push(`effect ${id}: missing frame sequence ${effect.frames}`);
    else for (const value of sequence) frame(value, `effect ${id}`);
  }
  for (const [category, id] of Object.entries(categories))
    frame(id, `affix category ${category}`);
  for (const [id, visual] of Object.entries(affixVisuals)) {
    if (visual.icon !== undefined) frame(visual.icon, `affix ${id}`);
    if (visual.category !== undefined && !has(categories, visual.category))
      errors.push(`affix ${id}: unknown category ${visual.category}`);
    if (!affixes.includes(id))
      warnings.push(`Visual mapping for unknown affix: ${id}`);
  }
  for (const id of affixes) {
    const visual = affixVisuals[id];
    if (!visual?.icon && !visual?.category)
      warnings.push(`Affix ${id} uses the generic icon without a category`);
  }
  return { errors, warnings };
}
