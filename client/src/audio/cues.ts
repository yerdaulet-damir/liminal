// Short synthesized cues. No assets: a key pickup needs to be instant and tiny, and the whole
// point is that both players hear the same thing at the same moment.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** A found-something chime: two clean tones, a fifth apart, gone in half a second. */
export function playPickup(): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  for (const [freq, delay] of [
    [880, 0],
    [1320, 0.08],
  ] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.45);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.5);
  }
}

/** The way out just became passable: lower, longer, and it does not sound friendly. */
export function playUnlocked(): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 1.2);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 1.35);
}
