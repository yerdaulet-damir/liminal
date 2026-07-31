// Regression: the `?level=` dev flag once fed the world seed, so the client drew keys from a
// different level than the server validated against — pickups silently failed (worst in the
// Poolrooms, where every screenshot used the preview). Geometry and keys must depend on the
// authoritative seed + world level; the art level may only change the rendering palette.

import { describe, expect, it } from "vitest";
import { generateLevel, hashSeed, levelSeed, placeKeys } from "@liminal/shared";
import { levelWorld } from "./levelWorld.js";

const seed = levelSeed(hashSeed("regression-room"), 0);

describe("levelWorld", () => {
  it("derives keys from the seed, never from the art level", () => {
    const asLobby = levelWorld(seed, 0, 0).keys;
    const asPoolPaint = levelWorld(seed, 0, 2).keys;
    expect(asPoolPaint).toEqual(asLobby);
    expect(asPoolPaint).toEqual(placeKeys(seed, generateLevel(seed, 0)));
  });

  it("derives maze geometry from the seed, never from the art level", () => {
    expect(levelWorld(seed, 0, 2).maze.walls).toEqual(levelWorld(seed, 0, 0).maze.walls);
    expect(levelWorld(seed, 0, 2).maze.thinWall).toEqual(generateLevel(seed, 0).thinWall);
    expect(levelWorld(seed, 3, 0).maze.walls).toEqual(generateLevel(seed, 3).walls);
  });

  it("keeps prop collision identical when only the paint override changes", () => {
    const lobby = levelWorld(seed, 0, 0).props;
    const warehouse = levelWorld(seed, 0, 1).props;
    expect(warehouse).toEqual(lobby);
  });

  it("returns the identical object for repeat calls (one generation per level)", () => {
    expect(levelWorld(seed, 3, 3)).toBe(levelWorld(seed, 3, 3));
  });
});
