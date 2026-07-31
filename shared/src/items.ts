// The Granny loop: the way out is locked until you find what's hidden. Seeded placement in
// dead-ends — the risky corners — plus creaky floor cells that betray you if you hurry.
// Pure: same seed → same hunt for both players and the server.

import { CELL } from "./constants.js";
import { generateMaze, type Maze } from "./procgen.js";
import { makeRng } from "./rng.js";

export const KEYS_PER_LEVEL = 3;

export interface KeyItem {
  id: number;
  x: number;
  z: number;
}

/** How many ways out a cell has. 1 = a dead end; 2 = a corridor you have to commit to. */
function exitCount(maze: Maze, cell: number): number {
  const o = maze.open[cell]!;
  return Number(o.n) + Number(o.e) + Number(o.s) + Number(o.w);
}

/** Cells ordered by how tucked-away they are: dead ends first, then corridors, never the spawn.
 *  Braiding leaves only ~1.7 true dead ends per level, so insisting on them made 61% of keys
 *  land somewhere random and the on-screen hint a lie. Ranking keeps the promise honest. */
function tuckedAwayCells(maze: Maze): number[] {
  const cells: number[] = [];
  for (let i = 1; i < maze.open.length; i++) cells.push(i);
  return cells.sort((a, b) => exitCount(maze, a) - exitCount(maze, b));
}

const centerOf = (maze: Maze, idx: number) => ({
  x: (idx % maze.cols) * CELL + CELL / 2,
  z: Math.floor(idx / maze.cols) * CELL + CELL / 2,
});

/** Where this level hides its keys. Prefers dead-ends; falls back to any far cell. */
export function placeKeys(seed: number, maze: Maze = generateMaze(seed)): KeyItem[] {
  const rng = makeRng(seed ^ 0x1717);
  const exitIdx =
    Math.floor(maze.exit.z / CELL) * maze.cols + Math.floor(maze.exit.x / CELL);
  const ranked = tuckedAwayCells(maze).filter((c) => c !== exitIdx);
  // take from the most tucked-away third, shuffled by the seed so it is not the same three
  // corners every run
  const pool = ranked.slice(0, Math.max(KEYS_PER_LEVEL, Math.ceil(ranked.length / 3)));
  const keys: KeyItem[] = [];
  const used = new Set<number>();
  for (let id = 0; id < KEYS_PER_LEVEL; id++) {
    let cell = pool[rng.int(0, pool.length)]!;
    let guard = pool.length * 4;
    while (used.has(cell) && guard-- > 0) cell = pool[rng.int(0, pool.length)]!;
    used.add(cell);
    keys.push({ id, ...centerOf(maze, cell) });
  }
  return keys;
}

/** Floor cells that creak. Hurrying over one is as loud as sprinting in the open. */
export function creakyCells(seed: number, maze: Maze = generateMaze(seed)): Set<number> {
  const rng = makeRng(seed ^ 0xc7ea4);
  const out = new Set<number>();
  const total = maze.cols * maze.rows;
  const count = Math.max(4, Math.floor(total * 0.12));
  while (out.size < count) out.add(rng.int(1, total));
  return out;
}

export const CREAK_NOISE = 0.7;
export const PICKUP_DIST = 1.4;
