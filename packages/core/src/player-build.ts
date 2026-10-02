/*
 * 所有跟当前用户有关的动态数据
 */

export type PlayerBuild = {
  level: number;
  move: {
    speed: number;
    safeRange: number;
    range: number;
    count: number;
  };
};
