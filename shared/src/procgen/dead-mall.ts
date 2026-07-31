import { CELL, WALL_THICKNESS } from "../constants.js";
import type { CellOpen, Maze, MazeZone, WallBox } from "../procgen.js";

const ATRIUM = { minI: 4, maxI: 7, minJ: 4, maxJ: 7 };
const FOOD_COURT = { minI: 0, maxI: 5, minJ: 0, maxJ: 2 };
const SERVICE_WING = { minI: 9, maxI: 11, minJ: 3, maxJ: 10 };

type Rect = typeof ATRIUM;

const indexOf = (cols: number, i: number, j: number): number => j * cols + i;

function cloneOpen(base: Maze): CellOpen[] {
  return base.open.map((cell) => ({ ...cell }));
}

function openPassage(open: CellOpen[], cols: number, a: number, b: number): void {
  const delta = b - a;
  if (delta === 1) {
    open[a]!.e = true;
    open[b]!.w = true;
  } else if (delta === -1) {
    open[a]!.w = true;
    open[b]!.e = true;
  } else if (delta === cols) {
    open[a]!.s = true;
    open[b]!.n = true;
  } else if (delta === -cols) {
    open[a]!.n = true;
    open[b]!.s = true;
  }
}

function cellsInRect(cols: number, rect: Rect): number[] {
  const cells: number[] = [];
  for (let j = rect.minJ; j <= rect.maxJ; j++) {
    for (let i = rect.minI; i <= rect.maxI; i++) cells.push(indexOf(cols, i, j));
  }
  return cells;
}

function openRect(open: CellOpen[], cols: number, rect: Rect): void {
  for (let j = rect.minJ; j <= rect.maxJ; j++) {
    for (let i = rect.minI; i <= rect.maxI; i++) {
      const cell = indexOf(cols, i, j);
      if (i < rect.maxI) openPassage(open, cols, cell, cell + 1);
      if (j < rect.maxJ) openPassage(open, cols, cell, cell + cols);
    }
  }
}

function storefrontLoop(cols: number): number[] {
  const cells: number[] = [];
  for (let i = 3; i <= 8; i++) cells.push(indexOf(cols, i, 3));
  for (let j = 4; j <= 8; j++) cells.push(indexOf(cols, 8, j));
  for (let i = 7; i >= 3; i--) cells.push(indexOf(cols, i, 8));
  for (let j = 7; j >= 4; j--) cells.push(indexOf(cols, 3, j));
  return cells;
}

function openLoop(open: CellOpen[], cols: number, cells: number[]): void {
  for (let index = 0; index < cells.length; index++) {
    openPassage(open, cols, cells[index]!, cells[(index + 1) % cells.length]!);
  }
}

function openServiceWing(open: CellOpen[], cols: number): void {
  for (let j = SERVICE_WING.minJ; j < SERVICE_WING.maxJ; j++) {
    openPassage(open, cols, indexOf(cols, 9, j), indexOf(cols, 9, j + 1));
  }
  for (const j of [3, 5, 7, 9, 10]) {
    openPassage(open, cols, indexOf(cols, 9, j), indexOf(cols, 10, j));
    openPassage(open, cols, indexOf(cols, 10, j), indexOf(cols, 11, j));
  }
}

function carveMall(open: CellOpen[], cols: number): MazeZone[] {
  const loop = storefrontLoop(cols);
  openRect(open, cols, ATRIUM);
  openRect(open, cols, FOOD_COURT);
  openLoop(open, cols, loop);
  openServiceWing(open, cols);
  openPassage(open, cols, indexOf(cols, 3, 2), indexOf(cols, 3, 3));
  openPassage(open, cols, indexOf(cols, 5, 3), indexOf(cols, 5, 4));
  openPassage(open, cols, indexOf(cols, 7, 7), indexOf(cols, 7, 8));
  openPassage(open, cols, indexOf(cols, 8, 5), indexOf(cols, 9, 5));
  return [
    { kind: "atrium", cells: cellsInRect(cols, ATRIUM) },
    { kind: "food-court", cells: cellsInRect(cols, FOOD_COURT) },
    { kind: "storefront-loop", cells: loop },
    { kind: "service-wing", cells: cellsInRect(cols, SERVICE_WING) },
  ];
}

function emitWalls(open: CellOpen[], cols: number, rows: number): WallBox[] {
  const walls: WallBox[] = [];
  const t = WALL_THICKNESS;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cell = open[indexOf(cols, i, j)]!;
      const x0 = i * CELL;
      const z0 = j * CELL;
      if (!cell.n) walls.push({ x: x0 + CELL / 2, z: z0, w: CELL + t, d: t });
      if (!cell.w) walls.push({ x: x0, z: z0 + CELL / 2, w: t, d: CELL + t });
      if (j === rows - 1 && !cell.s) {
        walls.push({ x: x0 + CELL / 2, z: z0 + CELL, w: CELL + t, d: t });
      }
      if (i === cols - 1 && !cell.e) {
        walls.push({ x: x0 + CELL, z: z0 + CELL / 2, w: t, d: CELL + t });
      }
    }
  }
  return walls;
}

function sameWall(a: WallBox, b: WallBox): boolean {
  return a.x === b.x && a.z === b.z && a.w === b.w && a.d === b.d;
}

export function generateDeadMall(base: Maze): Maze {
  const open = cloneOpen(base);
  const zones = carveMall(open, base.cols);
  const exit = {
    x: (base.cols - 0.5) * CELL,
    z: (SERVICE_WING.maxJ + 0.5) * CELL,
  };
  const thinWall = {
    x: base.cols * CELL,
    z: exit.z,
    w: WALL_THICKNESS,
    d: CELL + WALL_THICKNESS,
  };
  return {
    cols: base.cols,
    rows: base.rows,
    cell: base.cell,
    walls: emitWalls(open, base.cols, base.rows).filter((wall) => !sameWall(wall, thinWall)),
    open,
    start: { ...base.start },
    exit,
    thinWall,
    zones,
  };
}
