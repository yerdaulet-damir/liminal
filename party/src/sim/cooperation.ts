import { REVIVE_DIST, REVIVE_S, type Maze, type PlayerState } from "@liminal/shared";

export function tickRevives(players: PlayerState[], dt: number): void {
  for (const player of players) {
    if (!player.down) continue;
    const savior = players.find(
      (candidate) =>
        candidate !== player &&
        !candidate.down &&
        Math.hypot(candidate.x - player.x, candidate.z - player.z) < REVIVE_DIST,
    );
    player.reviveP = Math.max(0, Math.min(1, player.reviveP + (savior ? dt : -dt) / REVIVE_S));
    if (player.reviveP >= 1) {
      player.down = false;
      player.reviveP = 0;
    }
  }
}

export function canNoclip(players: PlayerState[], maze: Maze, keyCount: number): boolean {
  if (keyCount > 0) return false;
  const wall = maze.thinWall;
  const inside = players.length > 0 && players.every(
    (player) =>
      Math.abs(player.x - wall.x) < wall.w / 2 + 0.2 &&
      Math.abs(player.z - wall.z) < wall.d / 2 + 0.2,
  );
  return inside && players.every((player) => Math.hypot(player.x - wall.x, player.z - wall.z) < 4);
}
