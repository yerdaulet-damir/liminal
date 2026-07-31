import {
  PLAYER_RADIUS,
  pushOutOfCircles,
  resolveMove,
  type Maze,
  type PropPlacement,
} from "@liminal/shared";

interface Point {
  x: number;
  z: number;
}

function clampTarget(maze: Maze, point: Point): Point {
  const margin = PLAYER_RADIUS;
  return {
    x: Math.max(-margin, Math.min(maze.cols * maze.cell + margin, point.x)),
    z: Math.max(-margin, Math.min(maze.rows * maze.cell + margin, point.z)),
  };
}

export function resolveAuthoritativeMove(
  maze: Maze,
  props: readonly PropPlacement[],
  from: Point,
  requested: Point,
  maxStep: number,
): Point {
  const dx = requested.x - from.x;
  const dz = requested.z - from.z;
  const distance = Math.hypot(dx, dz);
  const scale = distance > maxStep ? maxStep / distance : 1;
  const target = clampTarget(maze, { x: from.x + dx * scale, z: from.z + dz * scale });
  const walls = resolveMove(maze, from.x, from.z, target.x, target.z, PLAYER_RADIUS);
  const pushed = pushOutOfCircles(walls.x, walls.z, PLAYER_RADIUS, props);
  const bounded = clampTarget(maze, pushed);
  return resolveMove(maze, from.x, from.z, bounded.x, bounded.z, PLAYER_RADIUS);
}
