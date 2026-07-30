// Monster voice — roar sting on hunt, breathing loop by proximity, scream on a kill.
// All CC0 freesound previews. Decoupled: audio failure never touches gameplay.

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let breathGain: GainNode | null = null;

async function load(name: string): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  const hit = buffers.get(name);
  if (hit) return hit;
  try {
    const res = await fetch(`/audio/${name}.mp3`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers.set(name, buf);
    return buf;
  } catch {
    return null;
  }
}

export async function startMonsterAudio(): Promise<void> {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    const breath = await load("breathing");
    if (breath) {
      const src = ctx.createBufferSource();
      src.buffer = breath;
      src.loop = true;
      breathGain = ctx.createGain();
      breathGain.gain.value = 0;
      src.connect(breathGain).connect(ctx.destination);
      src.start();
    }
    void load("roar");
    void load("scream");
  } catch {
    ctx = null;
  }
}

function sting(name: string, volume: number): void {
  if (!ctx) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(ctx.destination);
  src.start();
}

export const playRoar = (): void => sting("roar", 0.9);
export const playScream = (): void => sting("scream", 0.8);

/** Breathing loudness by distance — it is always somewhere. */
export function setBreathDistance(d: number): void {
  if (!breathGain || !ctx) return;
  const near = Math.max(0, 1 - d / 16);
  breathGain.gain.setTargetAtTime(near * 0.7, ctx.currentTime, 0.2);
}

export function stopMonsterAudio(): void {
  ctx?.close().catch(() => undefined);
  ctx = null;
  buffers.clear();
  breathGain = null;
}
