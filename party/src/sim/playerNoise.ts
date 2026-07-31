import {
  CREAK_NOISE,
  cellIndex,
  heardLoudness,
  rawLoudness,
  type Maze,
  type MonsterState,
  type PlayerState,
} from "@liminal/shared";

interface NoiseOptions {
  player: PlayerState;
  previous: { x: number; z: number } | undefined;
  maze: Maze;
  monster: MonsterState;
  mic: number;
  creaky: ReadonlySet<number>;
  dt: number;
}

export function measurePlayerNoise(options: NoiseOptions): { made: number; reaching: number } {
  const player = options.player;
  const speed = options.previous
    ? Math.hypot(player.x - options.previous.x, player.z - options.previous.z) / options.dt
    : 0;
  const creak = speed > 0.05 && options.creaky.has(cellIndex(options.maze, player.x, player.z))
    ? CREAK_NOISE
    : 0;
  const voice = Math.max(options.mic, creak);
  return {
    made: rawLoudness(speed, voice),
    reaching: heardLoudness(options.maze, player, options.monster, speed, voice),
  };
}
