/** World coordinates and directions in the battle plane. */
export type Position = Readonly<{ x: number; y: number }>;

export const Position = {
  distance(a: Position, b: Position): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  },
  direction(from: Position, to: Position): Position {
    return Position.normalize({ x: to.x - from.x, y: to.y - from.y });
  },
  normalize(vector: Position): Position {
    const length = Math.hypot(vector.x, vector.y);
    return length === 0
      ? { x: 0, y: 0 }
      : { x: vector.x / length, y: vector.y / length };
  },
  translate(
    position: Position,
    direction: Position,
    distance: number,
  ): Position {
    return {
      x: position.x + direction.x * distance,
      y: position.y + direction.y * distance,
    };
  },
  lerp(from: Position, to: Position, progress: number): Position {
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
  },
  is(value: unknown): value is Position {
    return (
      typeof value === "object" &&
      value !== null &&
      "x" in value &&
      "y" in value &&
      typeof value.x === "number" &&
      typeof value.y === "number" &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    );
  },
};
