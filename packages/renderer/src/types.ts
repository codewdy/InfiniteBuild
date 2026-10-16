import type {
  BattleLog,
  Config,
  MapLevel,
  UnitDefinition,
  Skill,
} from "@infinite-build/core";

/** Fixed definitions and interaction callbacks, supplied once at creation. */
export type BattlefieldOptions = {
  vision: Config["map"]["visionRange"];
  onTogglePlaying?: () => void;
  unitDefinitions?: Readonly<Record<string, UnitDefinition>>;
  skillDefinitions?: Readonly<Record<string, Skill.Definition>>;
};

export type BattlefieldState = {
  log: BattleLog;
  background: string;
  level?: Readonly<MapLevel>;
  mapName?: string;
  playing: boolean;
  frameDuration: number;
};

export type BattlefieldResetOptions = { transition?: boolean };

export type BattlefieldResult = {
  outcome: "Victory" | "Defeat";
  xpGain: number;
  rewards: readonly {
    kind: "skill" | "passive" | "support-skill" | "support-passive" | "pending";
    count: number;
  }[];
};
