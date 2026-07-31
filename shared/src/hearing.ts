// How loud a player reads to the entity. ONE pipeline for footsteps and the microphone —
// pure, so it can be reasoned about and tested without a socket or a browser.

import { collides } from "./collision.js";
import { MIC_HEAR_RANGE, MIC_WALL_DAMP, SPRINT_SPEED } from "./constants.js";
import type { Maze } from "./procgen.js";

/** Noise a body makes by moving, 0..1 — continuous in speed.
 *
 *  This used to be two steps either side of RUN_THRESHOLD (1.5), which was written when players
 *  walked at 3.0. Walking is now 1.8, so walking and sprinting produced the SAME 0.6 and crouch
 *  produced 0.3 — above the hearing gate. The whole stealth vocabulary the game teaches was
 *  dead. Scaling by speed restores it: crouch 0.2 (under the gate, truly silent),
 *  walk 0.4 (heard close by), sprint 0.8 (heard across the floor). */
export function footstepNoise(speedUps: number): number {
  if (speedUps <= 0.05) return 0;
  return Math.min(0.8, (speedUps / SPRINT_SPEED) * 0.8);
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

/** How much noise a body is making, before anything attenuates it. */
export function rawLoudness(speedUps: number, voiceOrCreak: number): number {
  return Math.max(footstepNoise(speedUps), voiceOrCreak);
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
