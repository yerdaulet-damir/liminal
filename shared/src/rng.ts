// Seeded PRNG — the ONLY source of randomness allowed in shared/. No Math.random, no Date.now.
// mulberry32: tiny, fast, deterministic. Same seed → same sequence on every client and the server.

export interface Rng {
  /** next float in [0, 1) */
  next(): number;
  /** next int in [min, max) */
  int(min: number, max: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min)),
  };
}

/** Seed for a specific level of a run — same base seed → same ladder of worlds. */
export function levelSeed(base: number, level: number): number {
  return hashSeed(`${base}/level/${level}`);
}

/** Deterministic 32-bit hash of a string (e.g. a room id → a maze seed). */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
