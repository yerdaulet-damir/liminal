// Per-level monster rules. Each rule is a different counter-play; these tests are the contract.

import { describe, it, expect } from "vitest";
import { makeMonster, stepMonster, type SensedPlayer } from "../src/monster.js";
import { generateMaze } from "../src/procgen.js";
import { makeRng } from "../src/rng.js";

const maze = generateMaze(31337);
const DT = 1 / 15;

/** A player standing at (x,z); ry faces the monster when `facing`. */
function player(x: number, z: number, m: { x: number; z: number }, facing: boolean, lit = false): SensedPlayer {
  const ry = Math.atan2(m.x - x, m.z - z) + (facing ? 0 : Math.PI);
  return { x, z, ry, lit };
}

/** How far the monster closes in 0.6 s of hunting — short enough not to saturate at contact.
 *  inMoodS is past HUNT_GRACE_S and the lunge is suppressed (dist > LUNGE_DIST) so we measure
 *  the rule's steady speed, not the burst. */
function closedDistance(rule: Parameters<typeof stepMonster>[3], facing: boolean, lit: boolean, dark = false) {
  const m = makeMonster({ x: maze.start.x + 8, z: maze.start.z });
  const p = player(maze.start.x, maze.start.z, m, facing, lit);
  const before = Math.hypot(m.x - p.x, m.z - p.z);
  const rng = makeRng(1);
  for (let i = 0; i < 9; i++) {
    const dist = Math.hypot(m.x - p.x, m.z - p.z);
    stepMonster(m, maze, "hunt", rule, { nearest: p, nearestDist: dist, loudest: p, dark }, [p], 10, DT, rng);
  }
  return before - Math.hypot(m.x - p.x, m.z - p.z);
}

describe("monster rules", () => {
  it("listener: staring it down slows it, but it still comes", () => {
    const stared = closedDistance("listener", true, false);
    const ignored = closedDistance("listener", false, false);
    expect(ignored).toBeGreaterThan(stared);
    expect(stared).toBeGreaterThan(0);
  });

  it("light-averse: the beam pins it (barely moves), darkness makes it faster", () => {
    // the beam points where you look, so both cases face it — only the light differs
    const pinned = closedDistance("light-averse", true, true);
    const free = closedDistance("light-averse", true, false);
    const inDark = closedDistance("light-averse", true, false, true);
    expect(pinned).toBeLessThan(free * 0.4);
    expect(inDark).toBeGreaterThan(free);
  });

  it("watcher: it cannot move at all while looked at (SCP-173)", () => {
    expect(closedDistance("watcher", true, false)).toBeCloseTo(0, 5);
    expect(closedDistance("watcher", false, false)).toBeGreaterThan(0);
  });

  it("retreating monster holds still and drops its lunge", () => {
    const m = makeMonster({ x: 10, z: 10 });
    m.lungeS = 0.4;
    const p = player(2, 2, m, false);
    stepMonster(m, maze, "retreat", "listener", { nearest: p, nearestDist: 9, loudest: null, dark: false }, [p], 1, DT, makeRng(2));
    expect(m).toMatchObject({ x: 10, z: 10, lungeS: -1 });
  });

  it("investigates the last heard POINT, not your live position", () => {
    const m = makeMonster({ x: maze.start.x + 10, z: maze.start.z });
    const noisy = player(maze.start.x, maze.start.z, m, false);
    const rng = makeRng(3);
    // one loud tick, then silence — it must keep walking toward where the sound WAS
    stepMonster(m, maze, "stalk", "listener", { nearest: noisy, nearestDist: 10, loudest: noisy, dark: false }, [noisy], 1, DT, rng);
    expect(m.heardPoint).toEqual({ x: noisy.x, z: noisy.z });
    const before = Math.hypot(m.x - noisy.x, m.z - noisy.z);
    const silent = { ...noisy, x: 99, z: 99 }; // the player teleports away and goes quiet
    for (let i = 0; i < 30; i++) {
      stepMonster(m, maze, "stalk", "listener", { nearest: silent, nearestDist: 99, loudest: null, dark: false }, [silent], 2, DT, rng);
    }
    // it closed on the remembered point, ignoring where the player actually is
    expect(Math.hypot(m.x - noisy.x, m.z - noisy.z)).toBeLessThan(before);
  });

  it("is deterministic: same seed and inputs → same path", () => {
    const walk = (seed: number) => {
      const m = makeMonster({ x: maze.start.x + 6, z: maze.start.z });
      const rng = makeRng(seed);
      const p = player(maze.start.x, maze.start.z, m, false);
      for (let i = 0; i < 60; i++) {
        stepMonster(m, maze, "calm", "listener", { nearest: p, nearestDist: 6, loudest: null, dark: false }, [p], 1, DT, rng);
      }
      return `${m.x.toFixed(6)},${m.z.toFixed(6)}`;
    };
    expect(walk(7)).toEqual(walk(7));
  });
});
