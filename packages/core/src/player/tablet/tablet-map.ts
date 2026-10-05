export namespace TabletMap {
  // prettier-ignore
  export const pos2Id = [
    [20, 21, 22, 23, 24],
    [19,  6,  7,  8,  9],
    [18,  5,  0,  1, 10],
    [17,  4,  3,  2, 11],
    [16, 15, 14, 13, 12],
  ];

  export const id2Pos = pos2Id.reduce<{ x: number; y: number }[]>(
    (positions, row, y) => {
      row.forEach((id, x) => {
        positions[id] = { x, y };
      });
      return positions;
    },
    [],
  );

  export const idSize = Math.max(...pos2Id.flat()) + 1;

  export type Rotate = 0 | 90 | 180 | 270;

  // 在 x 向右、y 向下的坐标系中，绕原点顺时针旋转。
  export function rotateVec(
    x: number,
    y: number,
    rotate: Rotate,
  ): [number, number] {
    switch (rotate) {
      case 0:
        return [x, y];
      case 90:
        return [-y, x];
      case 180:
        return [-x, -y];
      case 270:
        return [y, -x];
    }
  }

  export function move(
    id: number,
    x: number,
    y: number,
    rotate: Rotate,
  ): number | undefined {
    const position = id2Pos[id];
    if (!position) return undefined;
    const [dx, dy] = rotateVec(x, y, rotate);
    return pos2Id[position.y + dy]?.[position.x + dx];
  }
}
