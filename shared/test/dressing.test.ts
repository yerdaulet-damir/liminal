import { describe, expect, it } from "vitest";
import { creatureOf, generateMaze, placeDressing, type CreatureSkin } from "../src/index.js";

describe("dressing", () => {
  it("is a pure function of the seed", () => {
    const a = placeDressing(4242, generateMaze(4242), 0);
    const b = placeDressing(4242, generateMaze(4242), 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps the Poolrooms empty apart from the bodies", () => {
    const pool = placeDressing(7, generateMaze(7), 2);
    expect(pool.doors).toHaveLength(0);
    expect(pool.smilers).toHaveLength(0);
    expect(pool.figures.length).toBeGreaterThan(0);
  });

  it("gathers figures, not just scatters them", () => {
    // over many seeds both a ring and a row must show up, and a ring must face its own centre
    const arrangements = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      for (const f of placeDressing(seed, generateMaze(seed), 0).figures) {
        arrangements.add(f.arrangement);
      }
    }
    expect(arrangements).toEqual(new Set(["alone", "ring", "row"]));
  });

  it("sits the row down and stands the ring up", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const f of placeDressing(seed, generateMaze(seed), 0).figures) {
        if (f.arrangement === "row") expect(f.pose).toBe("sitting");
        if (f.arrangement === "ring") expect(f.pose).toBe("standing");
      }
    }
  });

  it("hangs every grin above eye level", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const s of placeDressing(seed, generateMaze(seed), 0).smilers) {
        expect(s.y).toBeGreaterThan(1.7); // EYE_HEIGHT
      }
    }
  });
});

describe("bestiary", () => {
  it("gives the same seed the same body, and different seeds different ones", () => {
    expect(creatureOf(99, 0)).toEqual(creatureOf(99, 0));
    const skins = new Set<CreatureSkin>();
    for (let seed = 0; seed < 60; seed++) skins.add(creatureOf(seed, 0)!.skin);
    expect(skins.size).toBeGreaterThan(1);
  });

  it("leaves the Poolrooms without a creature", () => {
    expect(creatureOf(1, 2)).toBeNull();
  });
});
