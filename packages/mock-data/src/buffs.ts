import { GameData, damage as dealDamage } from "@infinite-build/core";

export const ignite = GameData.defineBuff({
  id: "ignite",
  stack: "Independent",
  onUpdate(self, ctx) {
    if (self.isDead) return;
    const level = self.rawStatus.attributes["buff.ignite"] ?? 0;
    dealDamage(ctx, null, self, level);
  },
});

export const buffDefinitions = GameData.buffs([ignite]);
