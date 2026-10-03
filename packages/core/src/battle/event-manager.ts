import type { GameData } from "../game-data.js";
import type { BattleEvent } from "./battle-log.js";
export class EventManager {
  private events: BattleEvent.Event[] = [];
  private damageCounts = new Map<number, number>();
  private effectCounts = new Map<number, number>();

  constructor(private gameData: GameData) {}

  clear(): void {
    this.events = [];
    this.damageCounts.clear();
    this.effectCounts.clear();
  }

  addEvent(event: BattleEvent.Event): void {
    switch (event.kind) {
      case "Damage":
        this.addDamage(event);
        break;
      case "Move":
        this.addMove(event);
        break;
      case "PlayerSkillProgress":
        this.addPlayerSkillProgress(event);
        break;
      case "Effect":
        this.addEffect(event);
        break;
    }
  }

  addDamage(event: Omit<BattleEvent.Damage, "kind">): void {
    const count = this.damageCounts.get(event.dst) ?? 0;
    if (count >= this.gameData.config.event.maxEventPerUnit.damage) return;

    this.events.push({ ...event, kind: "Damage" });
    this.damageCounts.set(event.dst, count + 1);
  }

  addMove(event: Omit<BattleEvent.Move, "kind">): void {
    this.events.push({ ...event, kind: "Move" });
  }

  addPlayerSkillProgress(
    event: Omit<BattleEvent.PlayerSkillProgress, "kind">,
  ): void {
    this.events.push({ ...event, kind: "PlayerSkillProgress" });
  }

  addEffect(event: Omit<BattleEvent.Effect, "kind">): void {
    const count = this.effectCounts.get(event.source) ?? 0;
    if (count >= this.gameData.config.event.maxEventPerUnit.effect) return;

    this.events.push({ ...event, kind: "Effect" });
    this.effectCounts.set(event.source, count + 1);
  }

  getEvents(): BattleEvent.Event[] {
    return [...this.events];
  }
}
