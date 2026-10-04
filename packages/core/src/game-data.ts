/*
 * 所有跟游戏有关的静态数据
 */

import type { Unit, UnitSkills } from "./battle/unit.js";
import type { BattleContext } from "./battle/battle.js";
import type { Status } from "./battle/status.js";
import type { Routine } from "./battle/task-scheduler.js";

export type Config = {
  map: {
    spawnMinimumSize: number;
    visionRange: number;
  };
  event: {
    maxEventPerUnit: {
      damage: number;
      effect: number;
    };
  };
};

export type SkillParams = Record<string, unknown>;

export type SkillDefinition = {
  name: string;
  caster: (unit: Unit, ctx: BattleContext, params: SkillParams) => Routine;
};

export type UnitDefinition = {
  kind: string;
  status: Status.StatusConfig;
  move: {
    speed: number;
    range: {
      min: number;
      max: number;
    };
  };
  skills: UnitSkills;
  onUpdate?: (self: Unit, ctx: BattleContext) => void;
  onDeath?: (self: Unit, ctx: BattleContext) => void;
  onHitDealt?: (
    self: Unit,
    ctx: BattleContext,
    dst: Unit,
    amount: number,
  ) => void;
  onHitReceived?: (
    self: Unit,
    ctx: BattleContext,
    src: Unit,
    amount: number,
  ) => void;
  onDamageDealt?: (
    self: Unit,
    ctx: BattleContext,
    dst: Unit,
    amount: number,
  ) => void;
  onDamageReceived?: (
    self: Unit,
    ctx: BattleContext,
    src: Unit | null,
    amount: number,
  ) => void;
  onHeal?: (
    self: Unit,
    ctx: BattleContext,
    src: Unit | null,
    amount: number,
  ) => void;
  onKill?: (self: Unit, ctx: BattleContext, dst: Unit) => void;
};

export type MapDefinition = {
  totalValue: number;
  spawner: {
    mapSize: number;
    value: number;
    weight: number;
    enemies: {
      kind: string;
      count: {
        min: number;
        max: number;
      };
    }[];
  }[];
};

export type GameData = {
  unitDefinitions: Record<string, UnitDefinition>;
  mapDefinitions: Record<string, MapDefinition>;
  skillDefinitions: Record<string, SkillDefinition>;
  config: Config;
};
