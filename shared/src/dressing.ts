// The things that make it the Backrooms and not a maze: a door standing in the middle of a
// room leading nowhere, and people who are still here, in poses people do not hold.
//
// Pure and seeded, like everything else in shared — both players walk past the same corpse
// in the same wrong position, which is the entire point of it being unsettling.

import { CELL } from "./constants.js";
import { generateMaze, type Maze } from "./procgen.js";
import { makeRng, type Rng } from "./rng.js";

export type DoorKind = "single" | "wide" | "battered";

/** How a body ended up. None of these are how a living person stands. */
export type FigurePose =
  | "facing-wall" // stood in the corner, nose to the wallpaper, for a long time
  | "upside-down" // inverted, head into the carpet, legs to the ceiling
  | "collapsed" // face down where they fell
  | "sunken" // half through the floor, as if the room swallowed them mid-step
  | "leaning"; // propped against a wall at an angle nothing living holds

export interface DoorPlacement {
  kind: DoorKind;
  x: number;
  z: number;
  rotY: number;
  /** A door in open space with nothing behind it. The worst kind. */
  freestanding: boolean;
}

export interface FigurePlacement {
  model: number; // index into the client's figure list
  pose: FigurePose;
  x: number;
  z: number;
  rotY: number;
}

export interface Dressing {
  doors: DoorPlacement[];
  figures: FigurePlacement[];
}

const DOOR_KINDS: readonly DoorKind[] = ["single", "wide", "battered"];
const POSES: readonly FigurePose[] = [
  "facing-wall",
  "upside-down",
  "collapsed",
  "sunken",
  "leaning",
];

const centerOf = (maze: Maze, i: number, j: number) => ({
  x: i * CELL + CELL / 2,
  z: j * CELL + CELL / 2,
});

/** Pick `count` distinct cells, never the spawn cell. */
function pickCells(rng: Rng, maze: Maze, count: number): number[] {
  const total = maze.cols * maze.rows;
  const picked = new Set<number>();
  let guard = count * 40;
  while (picked.size < count && guard-- > 0) {
    const cell = rng.int(1, total);
    if (!picked.has(cell)) picked.add(cell);
  }
  return [...picked];
}

/**
 * Deterministic set dressing for a level. Level 2 (the Poolrooms) gets figures but no doors:
 * a body floating in shallow water needs no explanation, a door would only spoil the emptiness.
 */
export function placeDressing(seed: number, maze: Maze = generateMaze(seed), level = 0): Dressing {
  const rng = makeRng(seed ^ 0xd00d5); // its own stream: dressing never shifts key placement
  const doorCount = level >= 2 ? 0 : 3 + rng.int(0, 3);
  const figureCount = 2 + rng.int(0, 3);

  const doors: DoorPlacement[] = pickCells(rng, maze, doorCount).map((cell) => {
    const i = cell % maze.cols;
    const j = (cell - i) / maze.cols;
    const c = centerOf(maze, i, j);
    return {
      kind: DOOR_KINDS[rng.int(0, DOOR_KINDS.length)]!,
      // offset off the cell centre so it never blocks the walking line
      x: c.x + (rng.next() - 0.5) * 2.4,
      z: c.z + (rng.next() - 0.5) * 2.4,
      rotY: rng.next() * Math.PI * 2,
      freestanding: true,
    };
  });

  const figures: FigurePlacement[] = pickCells(rng, maze, figureCount).map((cell) => {
    const i = cell % maze.cols;
    const j = (cell - i) / maze.cols;
    const c = centerOf(maze, i, j);
    return {
      model: rng.int(0, 4),
      pose: POSES[rng.int(0, POSES.length)]!,
      x: c.x + (rng.next() - 0.5) * 2.2,
      z: c.z + (rng.next() - 0.5) * 2.2,
      rotY: rng.next() * Math.PI * 2,
    };
  });

  return { doors, figures };
}
