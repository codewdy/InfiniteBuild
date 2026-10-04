export namespace StackingPolicy {
  export type Kind = "Unique" | "Refresh" | "Extend" | "Independent";

  export interface Base {
    stack(level: number, duration: number): void;
    getLevel(): number;
    getTotalDuration(): number;
    getCurrentDuration(): number;
    update(): void;
    valid(): boolean;
  }

  export abstract class SharedDuration implements Base {
    level = 0;
    duration = 0;
    totalDuration = 0;
    current = 0;

    abstract stack(level: number, duration: number): void;

    getLevel(): number {
      return this.level;
    }

    getTotalDuration(): number {
      return this.totalDuration;
    }

    getCurrentDuration(): number {
      return this.current;
    }

    update(): void {
      if (!this.valid()) return;
      this.current = Math.min(this.totalDuration, this.current + 1);
      this.duration = Math.max(0, this.duration - 1);
      if (this.duration <= 0) {
        this.level = 0;
      }
    }

    valid(): boolean {
      return this.duration > 0;
    }
  }

  export class Unique extends SharedDuration {
    stack(level: number, duration: number): void {
      if (level >= this.level) {
        this.level = level;
        this.duration = duration;
        this.totalDuration = this.duration;
        this.current = 0;
      }
    }
  }

  export class Refresh extends SharedDuration {
    stack(level: number, duration: number): void {
      this.level += level;
      this.duration = Math.max(duration, this.duration);
      this.totalDuration = this.duration;
      this.current = 0;
    }
  }

  export class Extend extends SharedDuration {
    stack(level: number, duration: number): void {
      if (!this.valid()) {
        this.duration = 0;
        this.totalDuration = 0;
        this.current = 0;
      }
      this.level += level;
      this.duration += duration;
      this.totalDuration += duration;
    }
  }

  export class Independent implements Base {
    level = 0;
    currentTime = 0;
    totalDuration = 0;
    stackEOL = new Map<number, number>();

    stack(level: number, duration: number): void {
      if (duration <= 0) {
        return;
      }
      if (!this.valid()) {
        this.currentTime = 0;
        this.totalDuration = 0;
      }
      this.totalDuration = Math.max(
        this.totalDuration,
        this.currentTime + duration,
      );
      this.level += level;
      this.stackEOL.set(
        this.currentTime + duration,
        (this.stackEOL.get(this.currentTime + duration) ?? 0) + level,
      );
    }

    getLevel(): number {
      return this.level;
    }

    getTotalDuration(): number {
      return this.totalDuration;
    }

    getCurrentDuration(): number {
      return this.currentTime;
    }

    update(): void {
      if (!this.valid()) return;
      this.currentTime = Math.min(this.totalDuration, this.currentTime + 1);
      for (const [expiresAt, level] of this.stackEOL) {
        if (expiresAt <= this.currentTime) {
          this.level -= level;
          this.stackEOL.delete(expiresAt);
        }
      }
    }

    valid(): boolean {
      return this.stackEOL.size > 0;
    }
  }

  export const Kinds = {
    Unique: Unique,
    Refresh: Refresh,
    Extend: Extend,
    Independent: Independent,
  } satisfies Record<Kind, new () => Base>;
}
