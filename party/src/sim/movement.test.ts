import { describe, expect, it } from "vitest";
import type { Maze } from "@liminal/shared";
import { resolveAuthoritativeMove } from "./movement.js";

const maze: Maze = {
  cols: 2,
  rows: 2,
  cell: 4,
  walls: [{ x: 4, z: 2, w: 0.3, d: 4 }],
  open: [],
  start: { x: 2, z: 2 },
  exit: { x: 6, z: 6 },
  thinWall: { x: 8, z: 6, w: 0.3, d: 4 },
};

describe("authoritative player movement", () => {
  it("clamps speed and resolves the accepted step against walls", () => {
    const next = resolveAuthoritativeMove(maze, [], { x: 2, z: 2 }, { x: 20, z: 2 }, 0.5);
    expect(next).toEqual({ x: 2.5, z: 2 });

    const blocked = resolveAuthoritativeMove(maze, [], { x: 3.3, z: 2 }, { x: 4, z: 2 }, 0.5);
    expect(blocked).toEqual({ x: 3.3, z: 2 });
  });

  it("keeps requests inside bounded world space and outside props", () => {
    expect(resolveAuthoritativeMove(maze, [], { x: 2, z: 2 }, { x: -100, z: 2 }, 100)).toEqual({
      x: -0.4,
      z: 2,
    });
    const next = resolveAuthoritativeMove(
      maze,
      [{ kind: "chair", x: 2.4, z: 2, radius: 0.4, rotY: 0 }],
      { x: 2, z: 2 },
      { x: 2.4, z: 2 },
      1,
    );
    expect(Math.hypot(next.x - 2.4, next.z - 2)).toBeGreaterThanOrEqual(0.8 - 1e-6);
  });
});
