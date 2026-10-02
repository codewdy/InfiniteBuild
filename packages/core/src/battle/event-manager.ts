import type { Context } from "../context.js";
import type { BattleEvent } from "./battle-log.js";
export class EventManager {
  private events: BattleEvent.Event[] = [];
  private damageCounts = new Map<number, number>();

  constructor(private ctx: Context) {}

  clear(): void {
    this.events = [];
    this.damageCounts.clear();
  }

  addEvent(event: BattleEvent.Event): void {
    switch (event.kind) {
      case "Damage":
        this.addDamage(event);
        break;
      case "Move":
        this.addMove(event);
        break;
    }
  }

  addDamage(event: Omit<BattleEvent.Damage, "kind">): void {
    const count = this.damageCounts.get(event.dst) ?? 0;
    if (count >= this.ctx.gameData.config.event.maxEventPerUnit.damage) return;

    this.events.push({ ...event, kind: "Damage" });
    this.damageCounts.set(event.dst, count + 1);
  }

  addMove(event: Omit<BattleEvent.Move, "kind">): void {
    this.events.push({ ...event, kind: "Move" });
  }

  getEvents(): BattleEvent.Event[] {
    return [...this.events];
  }
}
