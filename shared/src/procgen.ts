// Deterministic maze generation. PURE: input seed → identical maze everywhere, forever.
// Recursive-backtracker (perfect maze: exactly one path between any two cells → always traversable).

import { makeRng } from "./rng.js";
import { CELL, MAZE_COLS, MAZE_ROWS, WALL_THICKNESS } from "./constants.js";

/** Axis-aligned wall, centered at (x, z) in world space, size w along X and d along Z. */
export interface WallBox {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Open passages per cell (true = you can walk that way). Indexed j*cols+i. */
export interface CellOpen {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

export interface Maze {
  cols: number;
  rows: number;
  cell: number;
  /** Solid walls — collide. */
  walls: WallBox[];
  open: CellOpen[];
  /** Spawn point (world space) — center of cell (0,0). */
  start: { x: number; z: number };
  /** Exit cell center (world space) — the cell farthest from start. Deterministic. */
  exit: { x: number; z: number };
  /** The noclip spot: a "thin" wall of the exit cell. Looks like a wall, but you can walk
   *  through it (canon: unstable matter). NOT in `walls`, so collision ignores it. */
  thinWall: WallBox;
}

interface Cell {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  visited: boolean;
}

export function generateMaze(
  seed: number,
  cols: number = MAZE_COLS,
  rows: number = MAZE_ROWS,
): Maze {
  const rng = makeRng(seed);
  const grid: Cell[] = Array.from({ length: cols * rows }, () => ({
    n: true,
    e: true,
    s: true,
    w: true,
    visited: false,
  }));
  const at = (i: number, j: number): Cell => grid[j * cols + i]!;

  // Iterative DFS carve from (0,0).
  const stack: Array<[number, number]> = [[0, 0]];
  at(0, 0).visited = true;
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1]!;
    const neighbors: Array<[number, number, keyof Cell, keyof Cell]> = [];
    if (j > 0 && !at(i, j - 1).visited) neighbors.push([i, j - 1, "n", "s"]);
    if (i < cols - 1 && !at(i + 1, j).visited) neighbors.push([i + 1, j, "e", "w"]);
    if (j < rows - 1 && !at(i, j + 1).visited) neighbors.push([i, j + 1, "s", "n"]);
    if (i > 0 && !at(i - 1, j).visited) neighbors.push([i - 1, j, "w", "e"]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const pick = neighbors[rng.int(0, neighbors.length)]!;
    const [ni, nj, here, there] = pick;
    at(i, j)[here] = false;
    at(ni, nj)[there] = false;
    at(ni, nj).visited = true;
    stack.push([ni, nj]);
  }

  // Level 0 is NOT a corridor maze — it's segmented open office space. Two passes:
  // braid (remove walls → loops/open areas) and doorways (wall with a gap → room feel).
  // Both mark the graph OPEN so players and the monster path through identically.
  const doorway = new Set<string>(); // "i,j,e" / "i,j,s" — interior walls to emit as stubs
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < cols - 1 && at(i, j).e) {
        const r = rng.next();
        if (r < 0.4) {
          at(i, j).e = false;
          at(i + 1, j).w = false;
        } else if (r < 0.65) {
          at(i, j).e = false;
          at(i + 1, j).w = false;
          doorway.add(`${i},${j},e`);
        }
      }
      if (j < rows - 1 && at(i, j).s) {
        const r = rng.next();
        if (r < 0.4) {
          at(i, j).s = false;
          at(i, j + 1).n = false;
        } else if (r < 0.65) {
          at(i, j).s = false;
          at(i, j + 1).n = false;
          doorway.add(`${i},${j},s`);
        }
      }
    }
  }

  // Emit wall boxes. Internal walls are shared between two cells; emit only N and W per
  // cell (plus the S/E boundary) so each internal wall is emitted exactly once.
  const t = WALL_THICKNESS;
  const walls: WallBox[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = at(i, j);
      const x0 = i * CELL;
      const z0 = j * CELL;
      if (c.n) walls.push({ x: x0 + CELL / 2, z: z0, w: CELL + t, d: t });
      if (c.w) walls.push({ x: x0, z: z0 + CELL / 2, w: t, d: CELL + t });
      if (j === rows - 1 && c.s) walls.push({ x: x0 + CELL / 2, z: z0 + CELL, w: CELL + t, d: t });
      if (i === cols - 1 && c.e) walls.push({ x: x0 + CELL, z: z0 + CELL / 2, w: t, d: CELL + t });
      // doorway stubs: the graph is open, the wall reads as a wall with a centered gap
      const gap = 1.8;
      const stub = (CELL - gap) / 2;
      if (doorway.has(`${i},${j},e`)) {
        walls.push({ x: x0 + CELL, z: z0 + stub / 2, w: t, d: stub });
        walls.push({ x: x0 + CELL, z: z0 + CELL - stub / 2, w: t, d: stub });
      }
      if (doorway.has(`${i},${j},s`)) {
        walls.push({ x: x0 + stub / 2, z: z0 + CELL, w: stub, d: t });
        walls.push({ x: x0 + CELL - stub / 2, z: z0 + CELL, w: stub, d: t });
      }
    }
  }

  // Structural pillars at interior grid intersections — the Level 0 signature. They sit on
  // cell corners, so cell-center pathing (players + monster BFS) never collides with them.
  for (let j = 1; j < rows; j++) {
    for (let i = 1; i < cols; i++) {
      if (rng.next() < 0.18) {
        walls.push({ x: i * CELL, z: j * CELL, w: 0.55, d: 0.55 });
      }
    }
  }

  const open: CellOpen[] = grid.map((c) => ({ n: !c.n, e: !c.e, s: !c.s, w: !c.w }));

  // Exit = farthest cell from start by BFS depth over the carved graph. Deterministic.
  const depth = new Array<number>(cols * rows).fill(-1);
  depth[0] = 0;
  const queue = [0];
  let far = 0;
  while (queue.length) {
    const idx = queue.shift()!;
    const o = open[idx]!;
    const nexts: number[] = [];
    if (o.n) nexts.push(idx - cols);
    if (o.s) nexts.push(idx + cols);
    if (o.w) nexts.push(idx - 1);
    if (o.e) nexts.push(idx + 1);
    for (const n of nexts) {
      if (depth[n] === -1) {
        depth[n] = depth[idx]! + 1;
        if (depth[n]! > depth[far]!) far = n;
        queue.push(n);
      }
    }
  }
  // Taking the single farthest cell put the exit in the same far corner 93% of the time —
  // after one run the "maze" was just a diagonal walk. Instead choose, by seeded RNG, any cell
  // that is *far enough* (>= 60% of the deepest). Still deterministic, no longer a tell.
  const deepest = depth[far]!;
  const distant: number[] = [];
  for (let idx = 0; idx < depth.length; idx++) {
    if (depth[idx]! >= deepest * 0.6) distant.push(idx);
  }
  const exitCell = distant.length > 0 ? distant[rng.int(0, distant.length)]! : far;
  const fi = exitCell % cols;
  const fj = (exitCell - fi) / cols;

  // The noclip spot: pick the exit cell's first still-standing wall (deterministic order)
  // and pull it OUT of the solid set — it renders as a wall but lets you through.
  const fc = at(fi, fj);
  const x0 = fi * CELL;
  const z0 = fj * CELL;
  let thinWall: WallBox;
  if (fc.n) thinWall = { x: x0 + CELL / 2, z: z0, w: CELL + t, d: t };
  else if (fc.w) thinWall = { x: x0, z: z0 + CELL / 2, w: t, d: CELL + t };
  else if (fc.s) thinWall = { x: x0 + CELL / 2, z: z0 + CELL, w: CELL + t, d: t };
  else thinWall = { x: x0 + CELL, z: z0 + CELL / 2, w: t, d: CELL + t };
  const solid = walls.filter(
    (w) => !(Math.abs(w.x - thinWall.x) < 1e-6 && Math.abs(w.z - thinWall.z) < 1e-6),
  );

  return {
    cols,
    rows,
    cell: CELL,
    walls: solid,
    open,
    start: { x: CELL / 2, z: CELL / 2 },
    exit: { x: fi * CELL + CELL / 2, z: fj * CELL + CELL / 2 },
    thinWall,
  };
}
