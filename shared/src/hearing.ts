// How loud a player reads to the entity. ONE pipeline for footsteps and the microphone —
// pure, so it can be reasoned about and tested without a socket or a browser.

import { collides } from "./collision.js";
import { MIC_HEAR_RANGE, MIC_WALL_DAMP, RUN_THRESHOLD } from "./constants.js";
import type { Maze } from "./procgen.js";

/** Noise a body makes by moving, 0..1. Crouch-slow is silent, sprinting is loud. */
export function footstepNoise(speedUps: number): number {
  if (speedUps > RUN_THRESHOLD) return 0.6;
  return speedUps > 0.05 ? 0.3 : 0;
}

/** Cheap occlusion: sample the segment, count wall crossings (capped at 2). */
export function wallsBetween(
  maze: Maze,
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  let hits = 0;
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    if (collides(maze, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.05)) hits++;
    if (hits >= 2) return 2;
  }
  return hits;
}

/** Effective loudness at the listener: max(footsteps, voice), then distance + walls. */
export function heardLoudness(
  maze: Maze,
  source: { x: number; z: number },
  listener: { x: number; z: number },
  speedUps: number,
  micLoudness: number,
): number {
  const raw = Math.max(footstepNoise(speedUps), micLoudness);
  if (raw <= 0) return 0;
  const dist = Math.hypot(source.x - listener.x, source.z - listener.z);
  if (dist >= MIC_HEAR_RANGE) return 0;
  const falloff = 1 - dist / MIC_HEAR_RANGE;
  return raw * falloff * MIC_WALL_DAMP ** wallsBetween(maze, source, listener);
}
