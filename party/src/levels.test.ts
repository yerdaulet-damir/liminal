import { describe, expect, it } from "vitest";
import { LAST_LEVEL, LEVELS, levelDef } from "./levels.js";

describe("level definitions", () => {
  it("defines Level IV as the dead mall with the watcher active", () => {
    expect(LEVELS[3]).toEqual({
      name: "the dead mall",
      rule: "watcher",
      breather: false,
      outages: false,
    });
    expect(LAST_LEVEL).toBe(3);
  });

  it("clamps levels beyond Level IV to the dead mall", () => {
    expect(levelDef(99)).toBe(LEVELS[3]);
  });
});
