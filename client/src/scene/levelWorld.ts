// One derivation of the level's world, shared by every component that needs it.
//
// Geometry and keys come from the room's SEED + AUTHORITATIVE LEVEL — the server validates
// pickups, prop collision, and noclip against exactly these positions, so nothing here may depend
// on anything the client can make up. `artLevel` is accepted to make caller intent explicit, but
// it can never move or replace a collidable object.

import {
  generateLevel,
  placeKeys,
  placeProps,
  type KeyItem,
  type Maze,
  type PropPlacement,
} from "@liminal/shared";

export interface LevelWorld {
  maze: Maze;
  props: PropPlacement[];
  keys: KeyItem[];
}

const cache = new Map<string, LevelWorld>();
const MAX_CACHED = 4;

/**
 * `worldLevel` chooses authoritative geometry. `artLevel` is only a renderer palette override.
 * Keeping both in the cache key makes caller intent inspectable while world data stays authoritative.
 */
export function levelWorld(seed: number, worldLevel: number, artLevel = worldLevel): LevelWorld {
  const id = `${seed}:${worldLevel}:${artLevel}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const maze = generateLevel(seed, worldLevel);
  const world: LevelWorld = {
    maze,
    props: placeProps(seed, maze, worldLevel),
    keys: placeKeys(seed, maze),
  };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(id, world);
  return world;
}
