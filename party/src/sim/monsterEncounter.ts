import {
  MIC_GATE,
  directorOnDown,
  stepMonster,
  tickDirector,
  wallsBetween,
  type Director,
  type Maze,
  type MonsterState,
  type PlayerState,
  type Rng,
  type SensedPlayer,
} from "@liminal/shared";

interface EncounterOptions {
  standing: PlayerState[];
  monster: MonsterState;
  maze: Maze;
  director: Director;
  reaching: ReadonlyMap<string, number>;
  rule: Parameters<typeof stepMonster>[3];
  dark: boolean;
  dt: number;
  rng: Rng;
}

const sensed = (player: PlayerState): SensedPlayer => ({
  x: player.x,
  z: player.z,
  ry: player.ry,
  lit: player.lit,
});

export function tickMonsterEncounter(options: EncounterOptions): PlayerState | null {
  let nearest = options.standing[0]!;
  let nearestDist = Infinity;
  let loudest: PlayerState | null = null;
  let loudestNoise = 0;
  for (const player of options.standing) {
    const distance = Math.hypot(player.x - options.monster.x, player.z - options.monster.z);
    if (distance < nearestDist) {
      nearestDist = distance;
      nearest = player;
    }
    const noise = options.reaching.get(player.id) ?? 0;
    if (noise > loudestNoise) {
      loudestNoise = noise;
      loudest = player;
    }
  }

  const exposed = nearestDist < 8 && wallsBetween(options.maze, nearest, options.monster) === 0;
  tickDirector(
    options.director,
    { nearestDistU: nearestDist, noise: loudestNoise, exposed, dtS: options.dt },
    options.rng,
  );
  const { caught } = stepMonster(
    options.monster,
    options.maze,
    options.director.mood,
    options.rule,
    {
      nearest: sensed(nearest),
      nearestDist,
      loudest: loudest && loudestNoise >= MIC_GATE ? sensed(loudest) : null,
      dark: options.dark,
    },
    options.standing.map(sensed),
    options.director.inStateS,
    options.dt,
    options.rng,
  );
  if (!caught) return null;
  nearest.down = true;
  nearest.reviveP = 0;
  directorOnDown(options.director, options.rng);
  options.monster.lungeS = -1;
  options.monster.staggerS = 0;
  return nearest;
}
