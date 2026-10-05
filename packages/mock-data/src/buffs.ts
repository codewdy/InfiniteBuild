import { z } from "zod";
import { GameData, damage as dealDamage } from "@infinite-build/core";

export const ignite = GameData.defineBuff({
  id: "ignite",
  params: z.object({}),
  stack: "Independent",
  threshold: 1,
  modifier(level) {
    return {
      tags: ["ignite"],
      triggers: {
        onUpdate: [
          (self, ctx) => {
            if (self.isDead) return;
            dealDamage(ctx, null, self, level);
          },
        ],
      },
    };
  },
});

export const buffDefinitions = GameData.buffs([ignite]);
