import type { Status } from "./status.js";

export namespace BattleEvent {
  export type Damage = {
    kind: "Damage";
    dst: number;
    damage: number;
  };
  export type Move = {
    kind: "Move";
    unit: number;
    direction: number;
    distance: number;
  };
  export type PlayerSkillProgress = {
    kind: "PlayerSkillProgress";
    uuid: string;
    skill: string;
    castRate: number;
    progress: number;
  };
  export type Effect = {
    kind: "Effect";
    effect: string;
    source: number;
    skill: string;
    payload: Record<string, unknown>;
  };
  export type Event = Damage | Move | PlayerSkillProgress | Effect;
}
export type BattleStatus = "Running" | "Victory" | "Defeat";
export type BattleLog = {
  frame: number;
  status: BattleStatus;
  units: {
    id: number;
    kind: string;
    position: number;
    hp: number;
    status: {
      attributes: Status.RawStatus["attributes"];
      tags: string[];
    };
  }[];
  events: BattleEvent.Event[];
};
