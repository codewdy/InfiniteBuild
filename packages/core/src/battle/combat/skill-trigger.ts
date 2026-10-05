import { cast, type SkillContext, type SkillParams } from "./skill.js";
import type { Unit } from "./unit.js";
import type { BattleContext } from "../battle.js";
import type { RandomGenerator } from "../random-generator.js";
import { Status } from "./status.js";

export type UnitSkill = {
  skill: string;
  uuid: string;
  params: SkillParams;
  castRate?: number;
};

const accumulateTypes = [
  "onUpdate",
  "onDamageDealt",
  "onDamageReceived",
] as const;
const chanceTypes = [
  "onHitDealt",
  "onHitReceived",
  "onHeal",
  "onKill",
  "onDeath",
] as const;

type AccumulateType = (typeof accumulateTypes)[number];
type ChanceType = (typeof chanceTypes)[number];
type EventType = AccumulateType | ChanceType;

export type UnitSkills = Partial<Record<EventType, UnitSkill[]>>;

function isAccumulateType(type: EventType): type is AccumulateType {
  return accumulateTypes.some((accumulateType) => accumulateType === type);
}

type Skills = Partial<Record<EventType, SkillContext[]>>;

export class SkillTrigger {
  progress = new Map<string, number>();
  skills: Skills = {};

  initializeProgress(rng: RandomGenerator, unit: Unit): void {
    for (const type of accumulateTypes) {
      for (const { uuid } of unit.skills[type] ?? []) {
        this.progress.set(uuid, rng.rand());
      }
    }
  }

  updateStatus(ctx: BattleContext, unit: Unit): void {
    this.skills = Object.fromEntries(
      Object.entries(unit.skills).map(([type, skills]) => [
        type,
        skills.map(({ uuid, skill, castRate, params }) => {
          const definition = ctx.gameData.skillDefinitions[skill];
          if (!definition) throw new Error(`Unknown skill: ${skill}`);
          const status = Status.apply(unit.status, []);
          return {
            uuid,
            skill,
            castRate,
            caster: definition.caster,
            battleContext: ctx,
            params: structuredClone(params),
            status,
            rawStatus: Status.resolve(status),
          };
        }),
      ]),
    );
  }

  trigger(ctx: BattleContext, unit: Unit, type: EventType, amount = 1): void {
    if (isAccumulateType(type)) {
      this.castByAccumulation(ctx, unit, type, amount);
    } else {
      this.castByChance(ctx, unit, type);
    }
  }

  private castByAccumulation(
    ctx: BattleContext,
    unit: Unit,
    type: AccumulateType,
    amount: number,
  ): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(
        "progress amount must be a finite non-negative number",
      );
    }
    for (const skill of this.skills[type] ?? []) {
      const { uuid, castRate } = skill;
      if (castRate === undefined) {
        cast(ctx, unit, skill);
        continue;
      }
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      const progress = (this.progress.get(uuid) ?? 0) + castRate * amount;
      if (!Number.isFinite(progress)) {
        throw new RangeError("skill progress must be finite");
      }
      this.progress.set(uuid, progress);
      // Read back progress after each cast, since casting can trigger more damage.
      while ((this.progress.get(uuid) ?? 0) >= 1 - 1e-6) {
        this.progress.set(
          uuid,
          Math.max(0, (this.progress.get(uuid) ?? 0) - 1),
        );
        cast(ctx, unit, skill);
      }
    }
  }

  private castByChance(ctx: BattleContext, unit: Unit, type: ChanceType): void {
    for (const skill of this.skills[type] ?? []) {
      const { uuid, castRate } = skill;
      if (castRate === undefined) {
        cast(ctx, unit, skill);
        continue;
      }
      if (!Number.isFinite(castRate) || castRate < 0) {
        throw new RangeError("castRate must be a finite non-negative number");
      }
      let casts = Math.floor(castRate);
      const chance = castRate - casts;
      if (chance > 0 && ctx.rng.rand() < chance) casts += 1;
      for (let index = 0; index < casts; index++) {
        cast(ctx, unit, skill);
      }
    }
  }
}
