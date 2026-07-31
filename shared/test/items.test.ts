// The Granny loop: keys hidden in dead-ends, creaky floors that betray you. Both seeded.

import { describe, it, expect } from "vitest";
import { CREAK_NOISE, KEYS_PER_LEVEL, creakyCells, placeKeys } from "../src/items.js";
import { generateMaze } from "../src/procgen.js";
import { MIC_GATE } from "../src/constants.js";
import { heardLoudness } from "../src/hearing.js";

const maze = generateMaze(90210);

describe("keys", () => {
  it("prefers the tightest cells it can find, not the open floor", () => {
    // The hint says "where the halls narrow", so most keys must actually land in cells with
    // few exits. Braiding leaves almost no true dead ends, hence "tight", not "dead end".
    let tight = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const m = generateMaze(1000 + i);
      for (const k of placeKeys(1000 + i, m)) {
        const idx = Math.floor(k.z / 4) * m.cols + Math.floor(k.x / 4);
        const o = m.open[idx]!;
        const exits = Number(o.n) + Number(o.e) + Number(o.s) + Number(o.w);
        total++;
        if (exits <= 2) tight++;
      }
    }
    expect(tight / total).toBeGreaterThan(0.5);
  });

  it("hides exactly KEYS_PER_LEVEL keys, deterministically, never on the spawn", () => {
    const a = placeKeys(90210, maze);
    expect(a).toHaveLength(KEYS_PER_LEVEL);
    expect(JSON.stringify(placeKeys(90210, maze))).toEqual(JSON.stringify(a));
    for (const k of a) expect(Math.hypot(k.x - maze.start.x, k.z - maze.start.z)).toBeGreaterThan(1);
  });

  it("puts every key in a different place", () => {
    const spots = new Set(placeKeys(90210, maze).map((k) => `${k.x},${k.z}`));
    expect(spots.size).toBe(KEYS_PER_LEVEL);
  });

  it("different levels hide them differently", () => {
    const l0 = JSON.stringify(placeKeys(1, generateMaze(1)));
    const l1 = JSON.stringify(placeKeys(2, generateMaze(2)));
    expect(l0).not.toEqual(l1);
  });
});

describe("creaky floors", () => {
  it("are seeded and cover a minority of the level", () => {
    const a = creakyCells(90210, maze);
    expect([...a].join()).toEqual([...creakyCells(90210, maze)].join());
    const total = maze.cols * maze.rows;
    expect(a.size).toBeGreaterThan(3);
    expect(a.size).toBeLessThan(total / 2);
  });

  it("a creak next to the monster is loud enough to be heard", () => {
    const loud = heardLoudness(maze, { x: 2, z: 2 }, { x: 4, z: 2 }, 1, CREAK_NOISE);
    expect(loud).toBeGreaterThan(MIC_GATE);
  });
});
