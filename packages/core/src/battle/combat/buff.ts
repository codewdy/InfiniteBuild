import { StackingPolicy } from "./stacking-policy.js";
import type { Status } from "./status.js";

export type BuffParams = Record<string, unknown>;

export type BuffDefinition = {
  stack: StackingPolicy.Kind;
  threshold?: number;
  modifier: (
    level: number,
    params: BuffParams,
    totalDuration: number,
    current: number,
  ) => Status.Modifier;
};

export type BuffStatus = {
  buff: string;
  level: number;
};

export class Buff {
  private readonly policy: StackingPolicy.Base;
  private params: BuffParams = {};

  private readonly threshold: number;
  private readonly createModifier: BuffDefinition["modifier"];

  constructor(
    readonly name: string,
    definition: BuffDefinition,
  ) {
    const threshold = definition.threshold ?? Infinity;
    if (Number.isNaN(threshold) || threshold <= 0) {
      throw new RangeError("threshold must be positive");
    }
    this.threshold = threshold;
    this.createModifier = definition.modifier;
    this.policy = new StackingPolicy.Kinds[definition.stack]();
  }

  stack(params: BuffParams, level: number, duration: number): void {
    if (!Number.isFinite(level) || level <= 0) {
      throw new RangeError("level must be a finite positive number");
    }
    if (!Number.isFinite(duration)) {
      throw new RangeError("duration must be finite");
    }
    if (duration <= 0) return;
    if (this.policy instanceof StackingPolicy.Unique && level < this.policy.getLevel()) {
      return;
    }
    const snapshot = structuredClone(params);
    this.policy.stack(level, duration);
    this.params = snapshot;
  }

  getLevel(): number {
    return Math.min(this.policy.getLevel(), this.threshold);
  }

  getTotalDuration(): number {
    return this.policy.getTotalDuration();
  }

  getCurrentDuration(): number {
    return this.policy.getCurrentDuration();
  }

  update(): void {
    this.policy.update();
  }

  valid(): boolean {
    return this.policy.valid();
  }

  modifier(): Status.Modifier {
    return this.valid()
      ? this.createModifier(
          this.getLevel(),
          this.params,
          this.getTotalDuration(),
          this.getCurrentDuration(),
        )
      : {};
  }
}

export class BuffManager {
  buffs: Buff[] = [];

  constructor(
    private readonly definitions: Record<string, BuffDefinition> = {},
  ) {}

  stack(
    buff: string,
    level: number,
    duration: number,
    params: BuffParams = {},
  ): void {
    duration = Math.floor(duration) + 1;
    if (duration <= 0) {
      return;
    }
    const definition = this.definitions[buff];
    if (!definition) throw new Error(`Unknown buff: ${buff}`);
    const existing = this.buffs.find((entry) => entry.name === buff);
    const instance = existing ?? new Buff(buff, definition);
    instance.stack(params, level, duration);
    if (!existing && instance.valid()) {
      this.buffs.push(instance);
    }
  }

  update(): void {
    for (const buff of this.buffs) buff.update();
    this.buffs = this.buffs.filter((buff) => buff.valid());
  }

  getBuffs(): BuffStatus[] {
    return this.buffs
      .filter((buff) => buff.valid())
      .map((buff) => ({
        buff: buff.name,
        level: buff.getLevel(),
      }));
  }

  getModifiers(): Status.Modifier[] {
    return this.buffs
      .filter((buff) => buff.valid())
      .map((buff) => buff.modifier());
  }
}
