/*
 * 所有跟当前用户有关的动态数据
 */

import type { UnitSkills } from "./battle/combat/unit.js";

export type PlayerBuild = {
  level: number;
  move: {
    speed: number;
    safeRange: number;
    range: number;
    count: number;
  };
  skills: UnitSkills;
};
