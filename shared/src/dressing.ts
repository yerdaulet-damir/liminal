// The things that make it the Backrooms and not a maze: doors standing in the middle of a room
// leading nowhere, people who are still here in poses people do not hold, and grins in the dark.
//
// Pure and seeded, like everything else in shared — both players walk past the same wrong thing
// in the same wrong place, which is the entire point of it being unsettling.

import { CELL } from "./constants.js";
import { generateMaze, type Maze } from "./procgen.js";
import { makeRng, type Rng } from "./rng.js";

export type DoorKind = "single" | "wide" | "battered";

/**
 * How a body is holding itself. The first five are whole-body wrongness (the room did this to
 * them); the rest are posed on the skeleton, so they read as people who chose to be like that,
 * which is worse.
 */
export type FigurePose =
  | "facing-wall" // stood in the corner, nose to the wallpaper, for a long time
  | "upside-down" // inverted, head into the carpet, legs to the ceiling
  | "collapsed" // face down where they fell
  | "sunken" // half through the floor, as if the room swallowed them mid-step
  | "leaning" // propped against a wall at an angle nothing living holds
  | "standing" // just standing. arms down. facing you.
  | "sitting" // on the floor, legs out, back straight, waiting
  | "kneeling" // knees down, sitting on their heels
  | "praying" // kneeling, folded forward, forehead to the carpet
  | "reaching" // both arms out in front, walking toward something that is not there
  | "head-tilt"; // standing, head rotated too far to one side

/** How figures are grouped. A single body is sad; four of them in a ring is a problem. */
export type FigureArrangement = "alone" | "ring" | "row";

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
  arrangement: FigureArrangement;
  x: number;
  z: number;
  rotY: number;
  /** 0..1 — how far the colour has been drained out of them. Not everyone has been here as long. */
  drain: number;
}

/** A grin at head height with nothing around it. Set dressing, not an entity: it never moves. */
export interface SmilerPlacement {
  x: number;
  z: number;
  /** Metres off the floor. They are never at your eye level, which is the tell. */
  y: number;
  /** How wide the grin is, 0..1. */
  width: number;
}

export interface Dressing {
  doors: DoorPlacement[];
  figures: FigurePlacement[];
  smilers: SmilerPlacement[];
}

const DOOR_KINDS: readonly DoorKind[] = ["single", "wide", "battered"];

/** Poses for a body found on its own. Mostly the wrong-body ones. */
const SOLO_POSES: readonly FigurePose[] = [
  "facing-wall",
  "upside-down",
  "collapsed",
  "sunken",
  "leaning",
  "sitting",
  "kneeling",
  "praying",
  "reaching",
  "head-tilt",
];

const FIGURE_MODELS = 4;

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

const cellCenter = (maze: Maze, cell: number) => {
  const i = cell % maze.cols;
  return centerOf(maze, i, (cell - i) / maze.cols);
};

/** A body on its own, dropped somewhere in the cell. */
function soloFigure(rng: Rng, maze: Maze, cell: number): FigurePlacement {
  const c = cellCenter(maze, cell);
  return {
    model: rng.int(0, FIGURE_MODELS),
    pose: SOLO_POSES[rng.int(0, SOLO_POSES.length)]!,
    arrangement: "alone",
    x: c.x + (rng.next() - 0.5) * 2.2,
    z: c.z + (rng.next() - 0.5) * 2.2,
    rotY: rng.next() * Math.PI * 2,
    drain: 0.45 + rng.next() * 0.5,
  };
}

/** Three to five of them standing in a circle, facing each other. Nobody is in the middle. */
function ringOfFigures(rng: Rng, maze: Maze, cell: number): FigurePlacement[] {
  const c = cellCenter(maze, cell);
  const count = 3 + rng.int(0, 3);
  const radius = 1.3 + rng.next() * 0.5;
  const offset = rng.next() * Math.PI * 2;
  const drain = 0.55 + rng.next() * 0.35; // one congregation, one age
  return Array.from({ length: count }, (_, k) => {
    const angle = offset + (k / count) * Math.PI * 2;
    return {
      model: rng.int(0, FIGURE_MODELS),
      pose: "standing" as const,
      arrangement: "ring" as const,
      x: c.x + Math.cos(angle) * radius,
      z: c.z + Math.sin(angle) * radius,
      rotY: angle + Math.PI, // shoulders to the wall, faces to the middle
      drain,
    };
  });
}

/** A row of them sitting shoulder to shoulder, like a waiting room whose number never came up. */
function rowOfFigures(rng: Rng, maze: Maze, cell: number): FigurePlacement[] {
  const c = cellCenter(maze, cell);
  const count = 3 + rng.int(0, 2);
  const facing = rng.int(0, 4) * (Math.PI / 2); // they all face the same way — a queue, not a crowd
  const alongX = Math.cos(facing + Math.PI / 2);
  const alongZ = Math.sin(facing + Math.PI / 2);
  const drain = 0.5 + rng.next() * 0.4;
  return Array.from({ length: count }, (_, k) => {
    const t = (k - (count - 1) / 2) * 1.05;
    return {
      model: rng.int(0, FIGURE_MODELS),
      pose: "sitting" as const,
      arrangement: "row" as const,
      x: c.x + alongX * t - Math.cos(facing) * 1.6,
      z: c.z + alongZ * t - Math.sin(facing) * 1.6,
      rotY: facing,
      drain,
    };
  });
}

/**
 * Deterministic set dressing for a level.
 *
 * Level 2 (the Poolrooms) is the breather: it keeps its bodies — one floating in shallow water
 * needs no explanation — but gets no doors and no grins, because emptiness is the whole point.
 */
export function placeDressing(seed: number, maze: Maze = generateMaze(seed), level = 0): Dressing {
  const rng = makeRng(seed ^ 0xd00d5); // its own stream: dressing never shifts key placement
  const empty = level >= 2;
  const doorCount = empty ? 0 : 3 + rng.int(0, 3);

  const doors: DoorPlacement[] = pickCells(rng, maze, doorCount).map((cell) => {
    const c = cellCenter(maze, cell);
    return {
      kind: DOOR_KINDS[rng.int(0, DOOR_KINDS.length)]!,
      // offset off the cell centre so it never blocks the walking line
      x: c.x + (rng.next() - 0.5) * 2.4,
      z: c.z + (rng.next() - 0.5) * 2.4,
      rotY: rng.next() * Math.PI * 2,
      freestanding: true,
    };
  });

  // Scarcity is the horror. A dozen bodies per floor turns them into furniture — and each one
  // is a skinned clone, so the budget is a rendering decision as much as a dramatic one.
  const figures = pickCells(rng, maze, 2 + rng.int(0, 2)).flatMap((cell) =>
    soloFigure(rng, maze, cell),
  );
  // At most ONE gathering per level: either they are standing in a circle or sitting in a row,
  // never both. Meeting it once is an event; meeting it twice is set dressing.
  if (!empty) {
    const cell = pickCells(rng, maze, 1)[0]!;
    figures.push(
      ...(rng.next() < 0.5
        ? ringOfFigures(rng, maze, cell)
        : rowOfFigures(rng, maze, cell)),
    );
  }

  const smilerCount = empty ? 0 : 2 + rng.int(0, 3);
  const smilers: SmilerPlacement[] = pickCells(rng, maze, smilerCount).map((cell) => {
    const c = cellCenter(maze, cell);
    return {
      x: c.x + (rng.next() - 0.5) * 3,
      z: c.z + (rng.next() - 0.5) * 3,
      y: 2.05 + rng.next() * 0.55, // above your eyeline, always
      width: 0.55 + rng.next() * 0.5,
    };
  });

  return { doors, figures, smilers };
}
