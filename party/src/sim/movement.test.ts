import { describe, expect, it } from "vitest";
import type { Maze } from "@liminal/shared";
import { CROUCH_SPEED, SPRINT_SPEED, TICK_MS, WALK_SPEED, type PlayerState } from "@liminal/shared";
import { PlayerMovement, resolveAuthoritativeMove } from "./movement.js";

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
      { x: 1.5, z: 2 },
      { x: 2.4, z: 2 },
      1,
    );
    expect(next).toEqual({ x: 1.5, z: 2 });
  });

  it("owns sprint exhaustion and cooldown even when sprint intent is forged forever", () => {
    const movement = new PlayerMovement();
    const player = makePlayer();
    let travelled = 0;
    for (let tick = 0; tick < 60; tick += 1) {
      movement.request(player.id, { x: 300, z: 2 }, "sprint");
      const before = player.x;
      movement.step([player], openMaze, [], TICK_MS / 1000);
      travelled += player.x - before;
    }

    expect(travelled).toBeCloseTo(SPRINT_SPEED * 3 + WALK_SPEED * 1, 5);
    expect(travelled).toBeLessThan(SPRINT_SPEED * 4);
  });

  it("restores sprint only after the authoritative cooldown completes", () => {
    const movement = new PlayerMovement();
    const player = makePlayer();
    for (let tick = 0; tick < 120; tick += 1) {
      movement.request(player.id, { x: 300, z: 2 }, "sprint");
      movement.step([player], openMaze, [], TICK_MS / 1000);
    }
    const before = player.x;
    movement.request(player.id, { x: 300, z: 2 }, "sprint");
    movement.step([player], openMaze, [], TICK_MS / 1000);
    expect(player.x - before).toBeCloseTo(SPRINT_SPEED * TICK_MS / 1000, 5);
  });

  it.each([
    ["walk", WALK_SPEED],
    ["crouch", CROUCH_SPEED],
    ["sprint", SPRINT_SPEED],
  ] as const)("moves an honest %s request at its authoritative speed", (mode, speed) => {
    const movement = new PlayerMovement();
    const player = makePlayer();
    for (let tick = 0; tick < 15; tick += 1) {
      movement.request(player.id, { x: 300, z: 2 }, mode);
      movement.step([player], openMaze, [], TICK_MS / 1000);
    }
    expect(player.x - 2).toBeCloseTo(speed, 5);
  });
});

const openMaze: Maze = {
  ...maze,
  cols: 100,
  walls: [],
  exit: { x: 398, z: 6 },
  thinWall: { x: 400, z: 6, w: 0.3, d: 4 },
};

function makePlayer(): PlayerState {
  return {
    id: "p1",
    name: "one",
    x: 2,
    z: 2,
    ry: 0,
    down: false,
    reviveP: 0,
    noise: 0,
    heard: false,
    lit: false,
    flashlightS: 0,
  };
}
