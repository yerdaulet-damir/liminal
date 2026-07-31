// The fluorescent hum IS the soundtrack (freesound #777053, CC0, seamless loop).
// It also carries gameplay: the hum swells as you approach the thin wall — the sound-first
// noclip cue from the design spec. Decoupled: audio failure never touches gameplay.

let ctx: AudioContext | null = null;
let base: GainNode | null = null;
let cue: GainNode | null = null;
let water: GainNode | null = null;

export async function startAmbience(): Promise<void> {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    const res = await fetch("/audio/hum.mp3");
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());

    const makeLoop = (gain: number): GainNode => {
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx!.createGain();
      g.gain.value = gain;
      src.connect(g).connect(ctx!.destination);
      src.start();
      return g;
    };
    base = makeLoop(0.10); // everywhere, quiet — the room breathes
    cue = makeLoop(0.0); // swells near the thin wall

    // the poolrooms water loop (silent until you fall into level 2)
    try {
      const wres = await fetch("/audio/water.mp3");
      const wbuf = await ctx.decodeAudioData(await wres.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = wbuf;
      src.loop = true;
      water = ctx.createGain();
      water.gain.value = 0;
      src.connect(water).connect(ctx.destination);
      src.start();
    } catch {
      water = null;
    }
  } catch {
    ctx = null; // no audio — the game goes on
  }
}

/** Poolrooms mode: water up, fluorescent hum down. */
export function setPoolMode(on: boolean): void {
  if (!ctx) return;
  water?.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.5);
  base?.gain.setTargetAtTime(on ? 0.02 : 0.1, ctx.currentTime, 0.5);
}

/** Distance from the player to the noclip wall; called every frame from the scene. */
const wallSeat = [Infinity, Infinity];

export function setThinWallDistance(dist: number, seat = 0): void {
  wallSeat[seat] = dist;
  const d = Math.min(wallSeat[0]!, wallSeat[1]!); // closest local player wins the speakers
  if (!cue || !ctx) return;
  const near = Math.max(0, 1 - d / 10); // audible from 10u out
  cue.gain.setTargetAtTime(near * 0.55, ctx.currentTime, 0.15);
}

export function stopAmbience(): void {
  ctx?.close().catch(() => undefined);
  ctx = null;
  base = null;
  cue = null;
}
