// Preserve the original character proportions at the reference battlefield height.
export const REFERENCE_HEIGHT = 290;
export const UNIT_SIZE_FACTOR = 0.75;
export const SKILL_SIZE_FACTOR = 0.65;
export const BATTLE_PROGRESS_HEIGHT = 16;
export const BATTLE_PROGRESS_BOTTOM = 14;
export const BATTLE_PROGRESS_GAP = 8;

export function unitY(id: number, kind: string, height: number): number {
  return kind === "Player" ? height * 0.55 : height * (0.34 + (id % 4) * 0.115);
}
