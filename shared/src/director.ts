// The AI director — Alien: Isolation's "big brain" in ~60 lines. Pure function on the
// server tick: (state, senses, rng) → state. The monster's BFS legs are the "little brain".

import type { Rng } from "./rng.js";
import {
  CALM_MAX_S,
  CALM_MIN_S,
  HUNT_MAX_S,
  MENACE_DECAY_PER_S,
  MENACE_NEAR_PER_S,
  MENACE_RETREAT_AT,
  MENACE_SEEN_PER_S,
  MIC_GATE,
  MIC_LOUD,
  MIC_SCREAM,
  RETREAT_MAX_S,
  RETREAT_MIN_S,
  STALK_TIMEOUT_S,
  SUSPICION_DECAY_EVERY_S,
  SUSPICION_HUNT_AT,
} from "./constants.js";

export type MonsterMood = "calm" | "stalk" | "hunt" | "retreat";

export interface Director {
  mood: MonsterMood;
  menace: number; // 0..100 — pressure valve
  suspicion: number; // Eyeless-Dog-style noise accumulator
  inStateS: number;
  stateBudgetS: number; // rolled per state entry (seeded)
  decayAccS: number;
}

export interface Senses {
  nearestDistU: number; // monster → nearest living player
  /** Loudest thing it can hear right now, 0..1 after distance + wall damping.
   *  One pipeline for footsteps AND the microphone — see room.measureNoise(). */
  noise: number;
  /** Nearest player is close AND nothing solid is between you. The creature is blind, so this
   *  is presence, not sight — it must never be able to sense you through a wall. */
  exposed: boolean;
  dtS: number;
}

export function makeDirector(): Director {
  // first calm budget is the constant minimum — the room adds its own 90 s spawn grace on top
  return { mood: "calm", menace: 0, suspicion: 0, inStateS: 0, stateBudgetS: CALM_MIN_S, decayAccS: 0 };
}

function enter(d: Director, mood: MonsterMood, rng: Rng): void {
  d.mood = mood;
  d.inStateS = 0;
  if (mood === "calm") d.stateBudgetS = CALM_MIN_S + rng.next() * (CALM_MAX_S - CALM_MIN_S);
  if (mood === "retreat") d.stateBudgetS = RETREAT_MIN_S + rng.next() * (RETREAT_MAX_S - RETREAT_MIN_S);
  if (mood === "hunt") d.menace = 0;
  if (mood === "retreat") d.suspicion = 0; // anti chain-hunt: one cough fit ≠ two hunts
}

export function tickDirector(d: Director, s: Senses, rng: Rng): void {
  d.inStateS += s.dtS;

  // menace: builds when it's close, decays otherwise
  const near = s.nearestDistU < 10;
  const seen = s.exposed;
  d.menace += (near ? MENACE_NEAR_PER_S : 0) * s.dtS + (seen ? MENACE_SEEN_PER_S : 0) * s.dtS;
  if (!near) d.menace -= MENACE_DECAY_PER_S * s.dtS;
  d.menace = Math.max(0, Math.min(100, d.menace));

  // suspicion by loudness (Eyeless Dog tuning): quiet is safe, a scream is instant death.
  if (d.mood !== "retreat") {
    if (s.noise >= MIC_SCREAM) d.suspicion = SUSPICION_HUNT_AT;
    else if (s.noise >= MIC_LOUD) d.suspicion += 3 * s.dtS;
    else if (s.noise >= MIC_GATE) d.suspicion += s.dtS;
  }
  d.decayAccS += s.dtS;
  if (d.decayAccS >= SUSPICION_DECAY_EVERY_S) {
    d.decayAccS = 0;
    d.suspicion = Math.max(0, d.suspicion - 1);
  }

  switch (d.mood) {
    case "calm":
      if (d.suspicion >= SUSPICION_HUNT_AT) enter(d, "hunt", rng);
      else if (d.inStateS >= d.stateBudgetS) enter(d, "stalk", rng);
      break;
    case "stalk":
      if (d.suspicion >= SUSPICION_HUNT_AT || (seen && d.inStateS > 1)) enter(d, "hunt", rng);
      else if (d.menace >= MENACE_RETREAT_AT) enter(d, "retreat", rng);
      else if (d.inStateS >= STALK_TIMEOUT_S) enter(d, "calm", rng);
      break;
    case "hunt":
      if (d.inStateS >= HUNT_MAX_S) enter(d, "retreat", rng);
      break;
    case "retreat":
      if (d.inStateS >= d.stateBudgetS) enter(d, "calm", rng);
      break;
  }
}

/** Call when the monster downs a player: it always backs off (no body-camping). */
export function directorOnDown(d: Director, rng: Rng): void {
  enter(d, "retreat", rng);
}
