import {
  CROUCH_SPEED,
  MAX_MOVE_PER_TICK_FACTOR,
  PLAYER_RADIUS,
  SPRINT_CD_MS,
  SPRINT_MS,
  SPRINT_SPEED,
  WALK_SPEED,
  pushOutOfCircles,
  resolveMove,
  type Maze,
  type MovementMode,
  type PlayerState,
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
  const resolved = resolveMove(maze, from.x, from.z, bounded.x, bounded.z, PLAYER_RADIUS);
  if (Math.hypot(resolved.x - from.x, resolved.z - from.z) > maxStep + 1e-6) return from;
  return resolved;
}

interface MovementRuntime {
  sprintMs: number;
  cooldownMs: number;
  credit: number;
}

interface MovementRequest extends Point {
  mode: MovementMode;
}

const freshRuntime = (): MovementRuntime => ({ sprintMs: SPRINT_MS, cooldownMs: 0, credit: 0 });

function resolveSpeed(
  state: MovementRuntime,
  mode: MovementMode,
  moving: boolean,
  dtMs: number,
): number {
  if (state.cooldownMs > 0) {
    state.cooldownMs = Math.max(0, state.cooldownMs - dtMs);
    if (state.cooldownMs === 0) state.sprintMs = SPRINT_MS;
    return mode === "crouch" ? CROUCH_SPEED : WALK_SPEED;
  }
  if (mode === "sprint" && moving && state.sprintMs > 0) {
    state.sprintMs = Math.max(0, state.sprintMs - dtMs);
    if (state.sprintMs < 1e-6) state.sprintMs = 0;
    if (state.sprintMs === 0) state.cooldownMs = SPRINT_CD_MS;
    return SPRINT_SPEED;
  }
  if (state.sprintMs < SPRINT_MS) {
    state.sprintMs = Math.min(SPRINT_MS, state.sprintMs + dtMs * 0.5);
  }
  return mode === "crouch" ? CROUCH_SPEED : WALK_SPEED;
}

export class PlayerMovement {
  private readonly requests = new Map<string, MovementRequest>();
  private readonly runtime = new Map<string, MovementRuntime>();

  request(id: string, target: Point, mode: MovementMode): void {
    this.requests.set(id, { ...target, mode });
  }

  disconnect(id: string): void {
    this.requests.delete(id);
    const state = this.runtime.get(id);
    if (state) state.credit = 0;
  }

  remove(id: string): void {
    this.requests.delete(id);
    this.runtime.delete(id);
  }

  reset(playerIds: Iterable<string>): void {
    this.requests.clear();
    this.runtime.clear();
    for (const id of playerIds) this.runtime.set(id, freshRuntime());
  }

  step(
    players: readonly PlayerState[],
    maze: Maze,
    props: readonly PropPlacement[],
    dt: number,
  ): void {
    for (const player of players) this.stepPlayer(player, maze, props, dt);
  }

  private stepPlayer(
    player: PlayerState,
    maze: Maze,
    props: readonly PropPlacement[],
    dt: number,
  ): void {
    const request = this.requests.get(player.id);
    this.requests.delete(player.id);
    const target = request ?? { x: player.x, z: player.z, mode: "walk" as const };
    const requestedDistance = Math.hypot(target.x - player.x, target.z - player.z);
    const state = this.runtime.get(player.id) ?? freshRuntime();
    this.runtime.set(player.id, state);
    const speed = resolveSpeed(state, target.mode, requestedDistance > 1e-6, dt * 1000);
    const baseDistance = speed * dt;
    state.credit = Math.min(baseDistance * MAX_MOVE_PER_TICK_FACTOR, state.credit + baseDistance);
    const next = resolveAuthoritativeMove(maze, props, player, target, state.credit);
    const travelled = Math.hypot(next.x - player.x, next.z - player.z);
    state.credit = Math.max(0, state.credit - travelled);
    player.x = next.x;
    player.z = next.z;
  }
}
