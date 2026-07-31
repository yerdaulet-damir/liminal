// Which body the creature wears. The RULES it plays by live in monster.ts and never change —
// this file only decides the silhouette, so a run feels different without the sim feeling
// different. Deterministic from the seed, because both players must meet the same thing.

import { makeRng } from "./rng.js";

export type CreatureSkin = "creep" | "demon" | "blue-demon" | "orc";

export interface Creature {
  skin: CreatureSkin;
  /** What survivors call it. Flavour only — the sim does not read this. */
  name: string;
  /** Metres, tip to floor. Every pack exports at its own units; the client normalizes to this. */
  height: number;
}

const BODIES: Record<CreatureSkin, Omit<Creature, "skin">> = {
  creep: { name: "the Hound", height: 2.3 },
  demon: { name: "the Skin-Stealer", height: 2.4 },
  "blue-demon": { name: "the Drowned", height: 2.2 },
  orc: { name: "the Hollow", height: 2.6 },
};

// The Poolrooms is empty by design — level 2 is the breather, and an empty list keeps it that way.
const BY_LEVEL: readonly (readonly CreatureSkin[])[] = [
  ["creep", "demon", "orc"],
  ["creep", "blue-demon", "orc"],
  [],
  [],
];

/** The creature for this seed and level, or null where nothing lives. */
export function creatureOf(seed: number, level: number): Creature | null {
  const pool = BY_LEVEL[level] ?? BY_LEVEL[0]!;
  if (pool.length === 0) return null;
  const rng = makeRng(seed ^ 0xbea51); // its own stream — skins never shift key or dressing placement
  const skin = pool[rng.int(0, pool.length)]!;
  return { skin, ...BODIES[skin] };
}
