import type { TabletSpec } from "@infinite-build/core";
import type { IconName, SupportDirectionIconName } from "./battlefield-assets.js";

/** Both renderers use the same artwork, base angle and fitting scale. */
export function resolveSupportTabletIcon(
  targets: readonly (readonly [number, number])[] | undefined,
  kind: "tablet-support-skill" | "tablet-support-passive",
  rarity: TabletSpec.Tablet["rarity"],
): { icon: IconName; angle: number; scale: number } {
  const base: IconName = rarity === "rare" ? "support-rare"
    : kind === "tablet-support-skill" ? "support-skill" : "support-passive";
  const key = targets?.map(([x, y]) => `${x},${y}`).sort().join(";");
  if (key === "1,-1") return { icon: base, angle: -45, scale: 0.76 };
  const directions: Record<string, "distant" | "line" | "opposite" | "diagonalPair"> = {
    "2,0": "distant",
    "1,0;2,0": "line",
    "-1,0;1,0": "opposite",
    "1,-1;1,1": "diagonalPair",
  };
  const direction = key === undefined ? undefined : directions[key];
  const icon: IconName = direction
    ? `support-${direction}-${rarity === "rare" ? "rare" : "magic"}` satisfies SupportDirectionIconName
    : base;
  return { icon, angle: 0, scale: 1 };
}
