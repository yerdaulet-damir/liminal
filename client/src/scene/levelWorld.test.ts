// Regression: the `?level=` dev flag once fed the world seed, so the client drew keys from a
// different level than the server validated against — pickups silently failed (worst in the
// Poolrooms, where every screenshot used the preview). Geometry and keys must depend on the
// seed ALONE; the art level may only change which prop models are used.

import { describe, expect, it } from "vitest";
import { generateMaze, hashSeed, levelSeed, placeKeys } from "@liminal/shared";
import { levelWorld } from "./levelWorld.js";

const seed = levelSeed(hashSeed("regression-room"), 0);

describe("levelWorld", () => {
  it("derives keys from the seed, never from the art level", () => {
    const asLobby = levelWorld(seed, 0).keys;
    const asPoolrooms = levelWorld(seed, 2).keys;
    expect(asPoolrooms).toEqual(asLobby);
    expect(asPoolrooms).toEqual(placeKeys(seed, generateMaze(seed)));
  });

  it("derives maze geometry from the seed, never from the art level", () => {
    expect(levelWorld(seed, 2).maze.walls).toEqual(levelWorld(seed, 0).maze.walls);
    expect(levelWorld(seed, 2).maze.thinWall).toEqual(generateMaze(seed).thinWall);
  });

  it("still lets the art level swap prop models at unchanged positions", () => {
    const lobby = levelWorld(seed, 0).props;
    const warehouse = levelWorld(seed, 1).props;
    expect(warehouse.map((p) => [p.x, p.z])).toEqual(lobby.map((p) => [p.x, p.z]));
    expect(warehouse.map((p) => p.kind)).not.toEqual(lobby.map((p) => p.kind));
  });

  it("returns the identical object for repeat calls (one generation per level)", () => {
    expect(levelWorld(seed, 0)).toBe(levelWorld(seed, 0));
  });
});
