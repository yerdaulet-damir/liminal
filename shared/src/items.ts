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

/** Cells with exactly one open side — the dead-ends you must walk INTO to loot. */
function deadEnds(maze: Maze): number[] {
  const out: number[] = [];
  for (let i = 0; i < maze.open.length; i++) {
    const o = maze.open[i]!;
    const exits = Number(o.n) + Number(o.e) + Number(o.s) + Number(o.w);
    if (exits === 1 && i !== 0) out.push(i);
  }
  return out;
}

const centerOf = (maze: Maze, idx: number) => ({
  x: (idx % maze.cols) * CELL + CELL / 2,
  z: Math.floor(idx / maze.cols) * CELL + CELL / 2,
});

/** Where this level hides its keys. Prefers dead-ends; falls back to any far cell. */
export function placeKeys(seed: number, maze: Maze = generateMaze(seed)): KeyItem[] {
  const rng = makeRng(seed ^ 0x1717);
  const pool = deadEnds(maze);
  const exitIdx =
    Math.floor(maze.exit.z / CELL) * maze.cols + Math.floor(maze.exit.x / CELL);
  const candidates = pool.filter((c) => c !== exitIdx);
  const keys: KeyItem[] = [];
  const used = new Set<number>();
  for (let id = 0; id < KEYS_PER_LEVEL; id++) {
    let cell: number;
    if (candidates.length > used.size) {
      do {
        cell = candidates[rng.int(0, candidates.length)]!;
      } while (used.has(cell));
    } else {
      // tiny/braided maze with too few dead-ends: any cell that isn't the spawn
      do {
        cell = rng.int(1, maze.cols * maze.rows);
      } while (used.has(cell));
    }
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
