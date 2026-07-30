// Deterministic prop placement — pure function of the seed. The client renders these,
// collision blocks against them, and both players (and any future server check) agree.

import { makeRng } from "./rng.js";
import { generateMaze, type Maze } from "./procgen.js";
import { CELL } from "./constants.js";

export type PropKind =
  | "chair"
  | "armchair"
  | "cabinet"
  | "lamp"
  | "couch"
  | "table"
  | "barrel"
  | "box"
  | "crates"
  | "boxstack";

// per-level dressing: Level 0 = abandoned office, Level 1 = warehouse/parking
const KIND_SETS: Array<Array<{ kind: PropKind; radius: number }>> = [
  [
    { kind: "chair", radius: 0.35 },
    { kind: "armchair", radius: 0.5 },
    { kind: "cabinet", radius: 0.45 },
    { kind: "lamp", radius: 0.28 },
    { kind: "couch", radius: 0.75 },
    { kind: "table", radius: 0.5 },
  ],
  [
    { kind: "barrel", radius: 0.45 },
    { kind: "box", radius: 0.55 },
    { kind: "crates", radius: 0.8 },
    { kind: "boxstack", radius: 0.7 },
    { kind: "barrel", radius: 0.45 },
    { kind: "box", radius: 0.55 },
  ],
  [], // the Poolrooms: emptiness IS the dressing
];

export interface PropPlacement {
  kind: PropKind;
  radius: number;
  x: number;
  z: number;
  rotY: number;
}

export function placeProps(
  seed: number,
  maze: Maze = generateMaze(seed),
  level = 0,
): PropPlacement[] {
  const rng = makeRng(seed ^ 0xc0ffee);
  const kinds = KIND_SETS[Math.min(level, KIND_SETS.length - 1)]!;
  const out: PropPlacement[] = [];
  if (kinds.length === 0) return out; // breather levels are empty on purpose
  for (let j = 0; j < maze.rows; j++) {
    for (let i = 0; i < maze.cols; i++) {
      if ((i === 0 && j === 0) || rng.next() > 0.22) continue;
      const pick = kinds[rng.int(0, kinds.length)]!;
      const ang = rng.next() * Math.PI * 2;
      const r = 1.1 + rng.next() * 0.4;
      out.push({
        kind: pick.kind,
        radius: pick.radius,
        x: i * CELL + CELL / 2 + Math.cos(ang) * r,
        z: j * CELL + CELL / 2 + Math.sin(ang) * r,
        rotY: rng.next() * Math.PI * 2,
      });
    }
  }
  return out;
}
