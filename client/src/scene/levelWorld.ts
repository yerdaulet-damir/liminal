// One derivation of the level's world, shared by every component that needs it.
//
// Geometry and keys come from the SEED ALONE, which the room owns — the server validates
// pickups and noclip against exactly these positions, so nothing here may depend on anything
// the client can make up. `artLevel` only chooses paint (which prop models to use); it can
// never move a wall or a key.

import { generateMaze, placeKeys, placeProps, type KeyItem, type Maze, type PropPlacement } from "@liminal/shared";

export interface LevelWorld {
  maze: Maze;
  props: PropPlacement[];
  keys: KeyItem[];
}

const cache = new Map<string, LevelWorld>();
const MAX_CACHED = 4;

/** Memoized per (seed, artLevel) so Maze, Props, Player and Keys all share one generation. */
export function levelWorld(seed: number, artLevel: number): LevelWorld {
  const id = `${seed}:${artLevel}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const maze = generateMaze(seed);
  const world: LevelWorld = {
    maze,
    props: placeProps(seed, maze, artLevel),
    keys: placeKeys(seed, maze),
  };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(id, world);
  return world;
}
