// The determinism test — the root invariant of the whole multiplayer game.
// If this ever fails, players will end up in different mazes. Treat a failure as a P0.

import { describe, it, expect } from "vitest";
import { generateLevel, generateMaze } from "../src/procgen.js";
import { hashSeed, levelSeed, makeRng } from "../src/rng.js";
import { cellIndex, nextStepToward } from "../src/path.js";
import { placeProps } from "../src/props.js";
import { placeKeys } from "../src/items.js";
import { pushOutOfCircles } from "../src/collision.js";

describe("maze determinism", () => {
  it("preserves the byte-identical legacy layout for levels 0-2", () => {
    for (const level of [0, 1, 2]) {
      const seed = levelSeed(0x5eed, level);
      expect(JSON.stringify(generateLevel(seed, level))).toEqual(JSON.stringify(generateMaze(seed)));
    }
  });

  it("same seed → byte-identical maze (this catches any Math.random/Date.now)", () => {
    const a = generateMaze(12345);
    const b = generateMaze(12345);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("a room id maps deterministically to the same seed → same maze", () => {
    const seed1 = hashSeed("spooky-hall-42");
    const seed2 = hashSeed("spooky-hall-42");
    expect(seed1).toEqual(seed2);
    expect(JSON.stringify(generateMaze(seed1))).toEqual(JSON.stringify(generateMaze(seed2)));
  });

  it("different seeds → different mazes", () => {
    const a = generateMaze(1);
    const b = generateMaze(2);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it("produces a non-trivial, bounded set of walls and a valid spawn", () => {
    const m = generateMaze(99, 8, 8);
    expect(m.walls.length).toBeGreaterThan(8);
    expect(m.start).toEqual({ x: m.cell / 2, z: m.cell / 2 });
  });

  it("is a perfect maze: every cell reachable from the spawn (flood fill the carved graph)", () => {
    // Rebuild connectivity from wall boxes the same way the renderer/collision sees the world,
    // then BFS from cell (0,0). A recursive-backtracker maze must reach all cells.
    const cols = 8;
    const rows = 8;
    const m = generateMaze(7, cols, rows);
    const cell = m.cell;
    const t = 0.3;
    const hasWall = (cx: number, cz: number, w: number, d: number): boolean =>
      m.walls.some(
        (wall) =>
          Math.abs(wall.x - cx) < 1e-6 &&
          Math.abs(wall.z - cz) < 1e-6 &&
          Math.abs(wall.w - w) < 1e-6 &&
          Math.abs(wall.d - d) < 1e-6,
      );
    const visited = new Set<string>();
    const queue: Array<[number, number]> = [[0, 0]];
    visited.add("0,0");
    while (queue.length) {
      const [i, j] = queue.shift()!;
      const x0 = i * cell;
      const z0 = j * cell;
      // north neighbor open if no wall on north edge of (i,j)
      const tryMove = (ni: number, nj: number, open: boolean) => {
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
        const key = `${ni},${nj}`;
        if (open && !visited.has(key)) {
          visited.add(key);
          queue.push([ni, nj]);
        }
      };
      tryMove(i, j - 1, !hasWall(x0 + cell / 2, z0, cell + t, t));
      tryMove(i, j + 1, !hasWall(x0 + cell / 2, z0 + cell, cell + t, t));
      tryMove(i - 1, j, !hasWall(x0, z0 + cell / 2, t, cell + t));
      tryMove(i + 1, j, !hasWall(x0 + cell, z0 + cell / 2, t, cell + t));
    }
    expect(visited.size).toEqual(cols * rows);
  });

  it("exit is deterministic, differs from start, and BFS chase reaches it", () => {
    const m = generateMaze(2024);
    expect(generateMaze(2024).exit).toEqual(m.exit);
    expect(m.exit).not.toEqual(m.start);
    // Walk cell-by-cell from start to exit via nextStepToward — must arrive within cols*rows steps.
    let cur = cellIndex(m, m.start.x, m.start.z);
    const goal = cellIndex(m, m.exit.x, m.exit.z);
    for (let i = 0; i < m.cols * m.rows && cur !== goal; i++) {
      const step = nextStepToward(m, cur, goal);
      expect(step).not.toBeNull();
      cur = cellIndex(m, step!.x, step!.z);
    }
    expect(cur).toEqual(goal);
  });

  it("prop placement is deterministic and props stay off cell centers", () => {
    const a = placeProps(555);
    expect(JSON.stringify(placeProps(555))).toEqual(JSON.stringify(a));
    expect(a.length).toBeGreaterThan(5);
    // every prop is offset ≥1.1 from its cell center → cell-center pathing stays clear
    for (const p of a) {
      const cx = Math.floor(p.x / 4) * 4 + 2;
      const cz = Math.floor(p.z / 4) * 4 + 2;
      expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThan(0.9);
    }
  });

  it("pushOutOfCircles blocks the center and leaves clear space alone", () => {
    const chair = [{ x: 5, z: 5, radius: 0.5 }];
    const pushed = pushOutOfCircles(5.1, 5, 0.4, chair);
    expect(Math.hypot(pushed.x - 5, pushed.z - 5)).toBeCloseTo(0.9, 5);
    expect(pushOutOfCircles(8, 8, 0.4, chair)).toEqual({ x: 8, z: 8 });
  });

  it("level ladder: deterministic per level, different across levels, distinct props", () => {
    const base = hashSeed("some-room");
    expect(levelSeed(base, 0)).toEqual(levelSeed(base, 0));
    expect(levelSeed(base, 0)).not.toEqual(levelSeed(base, 1));
    const m0 = generateMaze(levelSeed(base, 0));
    const m1 = generateMaze(levelSeed(base, 1));
    expect(JSON.stringify(m0)).not.toEqual(JSON.stringify(m1));
    const kinds1 = new Set(placeProps(levelSeed(base, 1), m1, 1).map((p) => p.kind));
    for (const k of kinds1) expect(["barrel", "box", "crates", "boxstack"]).toContain(k);
    expect(placeProps(levelSeed(base, 2), generateMaze(levelSeed(base, 2)), 2)).toEqual([]);
  });

  it("the exit is not always the same far corner (the maze must not be a diagonal)", () => {
    // It used to be the single BFS-farthest cell, which landed in one corner 93% of the time.
    const cells = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const m = generateMaze(hashSeed(`spread-${i}`));
      cells.add(`${Math.round(m.exit.x)},${Math.round(m.exit.z)}`);
    }
    expect(cells.size).toBeGreaterThan(20);
  });

  it("rng sequence is stable for a fixed seed", () => {
    const r = makeRng(42);
    const seq = [r.next(), r.next(), r.next()];
    const r2 = makeRng(42);
    expect([r2.next(), r2.next(), r2.next()]).toEqual(seq);
  });
});

describe("Dead Mall level", () => {
  const hashLayout = (maze: ReturnType<typeof generateLevel>): number => {
    let hash = 0x811c9dc5;
    for (const char of JSON.stringify(maze)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  };

  const reachable = (maze: ReturnType<typeof generateLevel>): Set<number> => {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      const index = queue.shift()!;
      const open = maze.open[index]!;
      const adjacent = [
        open.n ? index - maze.cols : -1,
        open.e ? index + 1 : -1,
        open.s ? index + maze.cols : -1,
        open.w ? index - 1 : -1,
      ];
      for (const next of adjacent) {
        if (next >= 0 && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };

  it("has a stable seed hash and varies across seeds", () => {
    const mall = generateLevel(0xdead, 3);
    expect(hashLayout(mall)).toBe(2_911_073_745);
    expect(hashLayout(generateLevel(0xdead, 3))).toBe(hashLayout(mall));
    expect(hashLayout(generateLevel(0xbeef, 3))).not.toBe(hashLayout(mall));
  });

  it("contains the connected mall macro-layout", () => {
    const mall = generateLevel(73, 3);
    expect(mall.zones?.map((zone) => zone.kind)).toEqual([
      "atrium",
      "food-court",
      "storefront-loop",
      "service-wing",
    ]);
    const seen = reachable(mall);
    for (const zone of mall.zones ?? []) {
      expect(zone.cells.length).toBeGreaterThan(3);
      for (const cell of zone.cells) expect(seen.has(cell)).toBe(true);
    }
  });

  it("shares collision footprints for the fountain and food-court tables", () => {
    const mall = generateLevel(73, 3);
    const props = placeProps(73, mall, 3);
    expect(props).toHaveLength(7);
    expect(props[0]).toMatchObject({ x: 24, z: 24, radius: 1.95 });
    for (const prop of props) {
      expect(Math.hypot(prop.x - mall.start.x, prop.z - mall.start.z)).toBeGreaterThan(
        prop.radius + 0.4,
      );
    }
  });

  it("keeps open passages reciprocal and in agreement with collision walls", () => {
    const mall = generateLevel(91, 3);
    const hasWall = (x: number, z: number, w: number, d: number): boolean =>
      mall.walls.some(
        (wall) =>
          Math.abs(wall.x - x) < 1e-6 &&
          Math.abs(wall.z - z) < 1e-6 &&
          Math.abs(wall.w - w) < 1e-6 &&
          Math.abs(wall.d - d) < 1e-6,
      );
    for (let j = 0; j < mall.rows; j++) {
      for (let i = 0; i < mall.cols; i++) {
        const index = j * mall.cols + i;
        const open = mall.open[index]!;
        if (i < mall.cols - 1) {
          expect(open.e).toBe(mall.open[index + 1]!.w);
          expect(open.e).toBe(
            !hasWall((i + 1) * mall.cell, j * mall.cell + mall.cell / 2, 0.3, mall.cell + 0.3),
          );
        }
        if (j < mall.rows - 1) {
          expect(open.s).toBe(mall.open[index + mall.cols]!.n);
          expect(open.s).toBe(
            !hasWall(i * mall.cell + mall.cell / 2, (j + 1) * mall.cell, mall.cell + 0.3, 0.3),
          );
        }
      }
    }
  });

  it("is traversable with reachable keys and exit over many seeds", () => {
    for (let seed = 0; seed < 100; seed++) {
      const mall = generateLevel(seed, 3);
      const seen = reachable(mall);
      expect(seen.size).toBe(mall.cols * mall.rows);
      expect(seen.has(cellIndex(mall, mall.exit.x, mall.exit.z))).toBe(true);
      for (const key of placeKeys(seed, mall)) {
        expect(seen.has(cellIndex(mall, key.x, key.z))).toBe(true);
      }
    }
  });
});
