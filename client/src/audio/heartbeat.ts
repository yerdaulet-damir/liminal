// Proximity heartbeat — pure WebAudio, no assets. Closer monster → faster, louder thumps.
// Decoupled from gameplay: if audio fails, nothing else breaks (invariant #8).

let ctx: AudioContext | null = null;
let dist = Infinity;
let timer: ReturnType<typeof setTimeout> | null = null;

function thump(volume: number): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 55;
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.14);
}

function schedule(): void {
  const near = Math.max(0, 1 - dist / 14); // audible within ~14 units
  if (near > 0) thump(0.05 + near * 0.25);
  const interval = 1100 - near * 750; // 1.1s calm → 0.35s panic
  timer = setTimeout(schedule, interval);
}

/** Call once from a user gesture (browser autoplay policy). Safe to call repeatedly. */
export function startHeartbeat(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    schedule();
  } catch {
    ctx = null; // no audio — game goes on
  }
}

// One speaker pair, possibly two local players: the heartbeat follows whoever is closest.
const seatDist = [Infinity, Infinity];

export function setMonsterDistance(d: number, seat = 0): void {
  seatDist[seat] = d;
  dist = Math.min(seatDist[0]!, seatDist[1]!);
}

export function stopHeartbeat(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  ctx?.close().catch(() => undefined);
  ctx = null;
}
