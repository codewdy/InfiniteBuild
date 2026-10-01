export type Suspension = { kind: "WaitFrames"; frames: number };

export type Routine = Generator<Suspension, void, void>;

type ScheduledTask = {
  routine: Routine;
  resumeFrame: number;
  done: boolean;
};

export class TaskScheduler {
  private frame: number = 0;
  private tasks: ScheduledTask[] = [];

  *waitFrames(frames: number): Routine {
    yield { kind: "WaitFrames", frames };
  }

  /** Executes immediately until the first yield, then schedules its continuation. */
  start(task: () => Routine): void {
    const scheduled = { routine: task(), resumeFrame: this.frame, done: false };
    this.tasks.push(scheduled);
    this.resume(scheduled);
  }

  tick(): void {
    this.frame += 1;
    // Newly started tasks run their first segment immediately, but their
    // continuations are excluded by capturing the initial task count.
    const count = this.tasks.length;
    try {
      for (let i = 0; i < count; i++) {
        const task = this.tasks[i]!;
        if (task.done || task.resumeFrame > this.frame) continue;
        this.resume(task);
      }
    } finally {
      // Stable, in-place compaction also preserves tasks started during this tick.
      let write = 0;
      for (let read = 0; read < this.tasks.length; read++) {
        const task = this.tasks[read]!;
        if (!task.done) this.tasks[write++] = task;
      }
      this.tasks.length = write;
    }
  }

  private resume(task: ScheduledTask): void {
    try {
      const result = task.routine.next();
      if (task.done) {
        return;
      }
      if (result.done) {
        task.done = true;
        return;
      }
      const frames = result.value.frames;
      if (!Number.isSafeInteger(frames) || frames <= 0) {
        task.routine.return();
        throw new RangeError("wait frames must be a positive safe integer");
      }
      task.resumeFrame = this.frame + frames;
    } catch (error) {
      task.done = true;
      throw error;
    }
  }

  executeFrame(frame: number): void {
    if (!Number.isSafeInteger(frame) || frame < 0) {
      throw new RangeError("frame must be a non-negative safe integer");
    }
    while (this.frame < frame) {
      this.tick();
    }
  }
}
