/*
 * 所有跟当前用户有关的动态数据
 */

import type { SkillParams } from "./game-data.js";

export type PlayerBuild = {
  level: number;
  move: {
    speed: number;
    safeRange: number;
    range: number;
    count: number;
  };
  skills: {
    uuid: string;
    skill: string;
    params: SkillParams;
    castRate: number;
  }[];
};
