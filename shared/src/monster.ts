// The monster's body: where it goes and how fast. The director (its mood) decides WHEN,
// the rule decides HOW — one rule per level, so a new monster is a new case, not a new branch
// scattered through the room. Pure: same inputs → same movement, testable without a socket.

import {
  CATCH_DIST,
  HUNT_GRACE_S,
  HUNT_SPEED,
  LIT_DOT,
  LIT_RANGE,
  LIT_SLOW,
  LUNGE_DIST,
  LUNGE_S,
  LUNGE_SPEED,
  PATROL_SPEED,
  STAGGER_S,
  STARE_DOT,
  STARE_SLOW,
} from "./constants.js";
import type { MonsterMood } from "./director.js";
import { wallsBetween } from "./hearing.js";
import { cellCenter, cellIndex, nextStepToward } from "./path.js";
import type { Maze } from "./procgen.js";
import type { Rng } from "./rng.js";

/** One rule per level. Adding a monster = adding a case here, nothing else changes. */
export type MonsterRule =
  | "listener" // blind; hunts the loudest sound. Level 0.
  | "light-averse" // the beam pins it; faster in the dark. Level 1.
  | "watcher"; // only moves while nobody looks at it (SCP-173).

export interface MonsterState {
  x: number;
  z: number;
  lungeS: number; // >= 0 while lunging
  staggerS: number; // > 0 while recovering from a missed lunge
  wanderTarget: number;
  /** Where it last heard something — it investigates the POINT, not you. */
  heardPoint: { x: number; z: number } | null;
  pingS: number;
}

export interface SensedPlayer {
  x: number;
  z: number;
  ry: number;
  lit: boolean;
}

export interface Sensed {
  nearest: SensedPlayer;
  nearestDist: number;
  /** Loudest audible player, if any is above the gate. */
  loudest: SensedPlayer | null;
  dark: boolean; // level 1 power outage
}

export function makeMonster(spawn: { x: number; z: number }): MonsterState {
  return { ...spawn, lungeS: -1, staggerS: 0, wanderTarget: -1, heardPoint: null, pingS: 0 };
}

/** Is any player's beam on it? (light-averse rule) */
export function litBy(m: MonsterState, players: readonly SensedPlayer[]): boolean {
  return players.some((p) => {
    if (!p.lit) return false;
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > LIT_RANGE || d < 1e-6) return false;
    return (Math.sin(p.ry) * dx + Math.cos(p.ry) * dz) / d > LIT_DOT;
  });
}

/** Is any player looking straight at it? (watcher rule / staring contest) */
export function observedBy(
  m: MonsterState,
  maze: Maze,
  players: readonly SensedPlayer[],
): boolean {
  return players.some((p) => {
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return false;
    const facing = (Math.sin(p.ry) * dx + Math.cos(p.ry) * dz) / d > STARE_DOT;
    return facing && wallsBetween(maze, p, m) === 0;
  });
}

/** Where it wants to be next, by mood. Investigating means walking to a REMEMBERED point. */
function goalFor(
  m: MonsterState,
  maze: Maze,
  mood: MonsterMood,
  s: Sensed,
  rng: Rng,
): { x: number; z: number } | null {
  const from = cellIndex(maze, m.x, m.z);
  if (mood === "calm") {
    if (m.wanderTarget < 0 || m.wanderTarget === from) {
      m.wanderTarget = rng.int(0, maze.cols * maze.rows);
    }
    return nextStepToward(maze, from, m.wanderTarget) ?? cellCenter(maze, m.wanderTarget);
  }
  if (mood === "stalk") {
    // investigate: head for the last heard point, not the player's live position
    const memory = m.heardPoint ?? { x: s.nearest.x, z: s.nearest.z };
    const to = cellIndex(maze, memory.x, memory.z);
    return from === to ? memory : nextStepToward(maze, from, to);
  }
  const prey = s.loudest ?? s.nearest; // hunt: it goes for whoever it can hear
  const to = cellIndex(maze, prey.x, prey.z);
  return from === to ? { x: prey.x, z: prey.z } : nextStepToward(maze, from, to);
}

/** Speed for this tick, after the level's rule and the player's counter-play. */
function speedFor(
  m: MonsterState,
  maze: Maze,
  mood: MonsterMood,
  rule: MonsterRule,
  s: Sensed,
  inMoodS: number,
  players: readonly SensedPlayer[],
): number {
  if (rule === "watcher" && observedBy(m, maze, players)) return 0;
  if (mood !== "hunt") return PATROL_SPEED;
  let speed = inMoodS <= HUNT_GRACE_S ? PATROL_SPEED : HUNT_SPEED;
  if (m.lungeS >= 0) speed = LUNGE_SPEED;

  if (rule === "light-averse") {
    if (s.dark) speed *= 1.3; // the dark is its element
    if (litBy(m, players)) speed *= LIT_SLOW; // pinned by the beam
  }
  if (rule === "listener" && observedBy(m, maze, players)) speed *= STARE_SLOW; // stare it down
  return speed;
}

export interface StepResult {
  /** True when it reached a player this tick — the room decides what that means. */
  caught: boolean;
}

/** Advance the monster one tick. Mutates state (it IS the state), returns what happened. */
export function stepMonster(
  m: MonsterState,
  maze: Maze,
  mood: MonsterMood,
  rule: MonsterRule,
  s: Sensed,
  players: readonly SensedPlayer[],
  inMoodS: number,
  dtS: number,
  rng: Rng,
): StepResult {
  if (mood === "retreat") {
    m.lungeS = -1;
    m.staggerS = 0;
    return { caught: false };
  }
  // remember what it heard — this is what makes "it almost heard me" possible
  if (s.loudest) m.heardPoint = { x: s.loudest.x, z: s.loudest.z };

  if (m.staggerS > 0) {
    m.staggerS -= dtS; // recovering from a miss: the escape window
    return { caught: false };
  }
  if (mood === "hunt") updateLunge(m, s, rule, inMoodS, dtS, players);

  const goal = goalFor(m, maze, mood, s, rng);
  const speed = speedFor(m, maze, mood, rule, s, inMoodS, players);
  if (goal && speed > 0) moveToward(m, goal, speed * dtS);

  const caught =
    mood === "hunt" && inMoodS > HUNT_GRACE_S && s.nearestDist < CATCH_DIST;
  return { caught };
}

function updateLunge(
  m: MonsterState,
  s: Sensed,
  rule: MonsterRule,
  inMoodS: number,
  dtS: number,
  players: readonly SensedPlayer[],
): void {
  if (m.lungeS >= 0) {
    m.lungeS += dtS;
    if (m.lungeS > LUNGE_S) {
      m.lungeS = -1;
      m.staggerS = STAGGER_S;
    }
    return;
  }
  const pinned = rule === "light-averse" && litBy(m, players);
  if (s.nearestDist < LUNGE_DIST && inMoodS > HUNT_GRACE_S && !pinned) m.lungeS = 0;
}

function moveToward(m: MonsterState, goal: { x: number; z: number }, step: number): void {
  const dx = goal.x - m.x;
  const dz = goal.z - m.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return;
  const t = Math.min(1, step / len);
  m.x += dx * t;
  m.z += dz * t;
}
