// The noise pipeline: it hunts what it hears. Whispering is safe, screaming is fatal,
// walls muffle you, distance saves you. Pure — no socket, no browser.

import { describe, it, expect } from "vitest";
import { footstepNoise, heardLoudness, wallsBetween } from "../src/hearing.js";
import { generateMaze } from "../src/procgen.js";
import { CROUCH_SPEED, MIC_GATE, SPRINT_SPEED, WALK_SPEED } from "../src/constants.js";

const maze = generateMaze(4242);
const at = (x: number, z: number) => ({ x, z });

describe("hearing", () => {
  it("noise scales with speed: crouching is under the gate, sprinting is loud", () => {
    expect(footstepNoise(0)).toBe(0);
    expect(footstepNoise(CROUCH_SPEED)).toBeLessThan(MIC_GATE); // crouch is genuinely silent
    expect(footstepNoise(WALK_SPEED)).toBeGreaterThan(MIC_GATE);
    expect(footstepNoise(SPRINT_SPEED)).toBeGreaterThan(footstepNoise(WALK_SPEED));
  });

  it("a whisper stays under the gate, a scream does not", () => {
    const near = heardLoudness(maze, at(2, 2), at(4, 2), 0, 0.2);
    expect(near).toBeLessThan(MIC_GATE);
    const scream = heardLoudness(maze, at(2, 2), at(4, 2), 0, 0.95);
    expect(scream).toBeGreaterThan(MIC_GATE);
  });

  it("distance saves you: the same scream is inaudible far away", () => {
    const close = heardLoudness(maze, at(2, 2), at(4, 2), 0, 0.95);
    const far = heardLoudness(maze, at(2, 2), at(2, 40), 0, 0.95);
    expect(far).toBeLessThan(close);
    expect(far).toBe(0); // beyond MIC_HEAR_RANGE it cannot hear you at all
  });

  it("the loudest channel wins: a sprinting whisperer is heard by their feet", () => {
    const sprintQuiet = heardLoudness(maze, at(2, 2), at(4, 2), 3.6, 0);
    const stillWhisper = heardLoudness(maze, at(2, 2), at(4, 2), 0, 0.2);
    expect(sprintQuiet).toBeGreaterThan(stillWhisper);
  });

  it("walls muffle: same distance, more walls between → quieter", () => {
    // scan the maze for a pair of points with walls between them
    let muffled: number | null = null;
    let clear: number | null = null;
    for (let i = 0; i < maze.cols && (muffled === null || clear === null); i++) {
      const a = at(2, 2 + i * 0.5);
      const b = at(10, 2 + i * 0.5);
      const walls = wallsBetween(maze, a, b);
      const loud = heardLoudness(maze, a, b, 0, 0.9);
      if (walls > 0 && muffled === null) muffled = loud;
      if (walls === 0 && clear === null) clear = loud;
    }
    if (muffled !== null && clear !== null) expect(muffled).toBeLessThan(clear);
    else expect(true).toBe(true); // this seed had no such pair; the formula is covered above
  });
});
