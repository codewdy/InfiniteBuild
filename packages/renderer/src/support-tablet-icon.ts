import type { TabletSpec } from "@infinite-build/core";
import type { IconName, SupportDirectionIconName } from "./battlefield-assets.js";

/** Both renderers use the same artwork and base angle. */
export function resolveSupportTabletIcon(
  targets: readonly (readonly [number, number])[] | undefined,
  kind: "tablet-support-skill" | "tablet-support-passive",
  rarity: TabletSpec.Tablet["rarity"],
): { icon: IconName; angle: number; offset: [number, number] } {
  const base: IconName = rarity === "rare" ? "support-rare"
    : kind === "tablet-support-skill" ? "support-skill" : "support-passive";
  const key = targets?.map(([x, y]) => `${x},${y}`).sort().join(";");
  const directions: Record<string, "distant" | "line" | "opposite" | "diagonal" | "diagonalPair"> = {
    "2,0": "distant",
    "1,-1": "diagonal",
    "1,0;2,0": "line",
    "-1,0;1,0": "opposite",
    "1,-1;1,1": "diagonalPair",
  };
  const direction = key === undefined ? undefined : directions[key];
  const icon: IconName = direction
    ? `support-${direction}-${rarity === "rare" ? "rare" : "magic"}` satisfies SupportDirectionIconName
    : base;
  return { icon, angle: 0, offset: [0, 0] };
}

/** Normalize visible stone bounds to the original support tablet proportions. */
export function supportTabletScale(
  frame: { width: number; height: number },
  reference: { width: number; height: number },
  preserveAspect = false,
): { x: number; y: number } {
  // Diagonal arrow symmetry requires equal scaling on both axes.
  if (preserveAspect) return { x: 1, y: 1 };
  const square = Math.max(frame.width, frame.height);
  return {
    x: square / frame.width,
    y: (square / frame.height) * (reference.height / reference.width),
  };
}
