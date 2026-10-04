export { Game } from "./game.js";
export { Battle } from "./battle/battle.js";
export { spawnUnits, move, fixPosition } from "./battle/combat/movement.js";
export { hit, damage } from "./battle/combat/damage.js";
export { updateStatus, resolveDeath } from "./battle/combat/unit-status.js";
export type { BattleSpec } from "./battle/battle.js";
export type { BattleEvent, BattleLog } from "./battle/battle-log.js";
export type { UnitSkill, UnitSkills } from "./battle/combat/unit.js";
export { cast } from "./battle/combat/skill.js";
export type { SkillDefinition, SkillParams } from "./battle/combat/skill.js";
export type { UnitDefinition } from "./battle/combat/regular-unit.js";
export type { PlayerBuild } from "./player-build.js";
export type {
  Config,
  GameData,
  MapDefinition,
} from "./game-data.js";
