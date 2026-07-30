// Pure collision against maze walls. Circle (radius r) vs. axis-aligned wall boxes, axis-separated
// so the player slides along walls instead of sticking. Shared so client feel and any future
// server-side validation use the identical rule.

import type { Maze } from "./procgen.js";

export function collides(maze: Maze, x: number, z: number, r: number): boolean {
  for (const wall of maze.walls) {
    const hw = wall.w / 2 + r;
    const hd = wall.d / 2 + r;
    if (Math.abs(x - wall.x) < hw && Math.abs(z - wall.z) < hd) return true;
  }
  return false;
}

/** Move from (fx,fz) toward (tx,tz), blocking per-axis on wall contact. Returns the resolved point. */
export function resolveMove(
  maze: Maze,
  fx: number,
  fz: number,
  tx: number,
  tz: number,
  r: number,
): { x: number; z: number } {
  let x = fx;
  let z = fz;
  if (!collides(maze, tx, z, r)) x = tx;
  if (!collides(maze, x, tz, r)) z = tz;
  return { x, z };
}

/** Push a circle of radius r out of round obstacles (props). Returns the corrected point. */
export function pushOutOfCircles(
  x: number,
  z: number,
  r: number,
  obstacles: ReadonlyArray<{ x: number; z: number; radius: number }>,
): { x: number; z: number } {
  for (const o of obstacles) {
    const dx = x - o.x;
    const dz = z - o.z;
    const min = r + o.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    if (d < 1e-6) {
      x = o.x + min; // dead-center overlap: push along +x, next frame fixes direction
      continue;
    }
    x = o.x + (dx / d) * min;
    z = o.z + (dz / d) * min;
  }
  return { x, z };
}
