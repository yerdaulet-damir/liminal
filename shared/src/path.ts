// Cell-graph BFS for the monster chase. Pure; used by the server tick (and tests).

import type { Maze } from "./procgen.js";

export function cellIndex(maze: Maze, x: number, z: number): number {
  const i = Math.min(maze.cols - 1, Math.max(0, Math.floor(x / maze.cell)));
  const j = Math.min(maze.rows - 1, Math.max(0, Math.floor(z / maze.cell)));
  return j * maze.cols + i;
}

export function cellCenter(maze: Maze, idx: number): { x: number; z: number } {
  const i = idx % maze.cols;
  const j = (idx - i) / maze.cols;
  return { x: i * maze.cell + maze.cell / 2, z: j * maze.cell + maze.cell / 2 };
}

/** Center of the next cell on the shortest path from→to, or null if already there. */
export function nextStepToward(maze: Maze, from: number, to: number): { x: number; z: number } | null {
  if (from === to) return null;
  // BFS from target so prev[] points one step closer to the target from any cell.
  const prev = new Array<number>(maze.cols * maze.rows).fill(-1);
  prev[to] = to;
  const queue = [to];
  while (queue.length) {
    const idx = queue.shift()!;
    if (idx === from) break;
    const o = maze.open[idx]!;
    const nexts: number[] = [];
    if (o.n) nexts.push(idx - maze.cols);
    if (o.s) nexts.push(idx + maze.cols);
    if (o.w) nexts.push(idx - 1);
    if (o.e) nexts.push(idx + 1);
    for (const n of nexts) {
      if (prev[n] === -1) {
        prev[n] = idx;
        queue.push(n);
      }
    }
  }
  const next = prev[from];
  if (next === -1 || next === undefined) return null; // unreachable (shouldn't happen in a perfect maze)
  return cellCenter(maze, next);
}
