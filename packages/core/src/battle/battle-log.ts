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
  export type Event = Damage | Move;
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
    status: Status.RawStatus;
  }[];
  events: BattleEvent.Event[];
};
