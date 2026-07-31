// The microphone as a game input: the entity hears your real voice.
// Local analysis only — we never transmit audio, just one loudness byte per tick.
// (Voice CHAT is a separate concern; this works with players on Discord too.)

import { MIC_GATE } from "@liminal/shared";

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let data: Uint8Array<ArrayBuffer> | null = null;
let mediaStream: MediaStream | null = null;
let enabled = false;

/** Ask for the mic. Returns false if denied — the game plays on without it. */
export async function enableMic(): Promise<boolean> {
  if (enabled) return true;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(mediaStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    src.connect(analyser);
    enabled = true;
    return true;
  } catch {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    ctx?.close().catch(() => undefined);
    ctx = null;
    analyser = null;
    data = null;
    enabled = false;
    return false;
  }
}

export const micEnabled = (): boolean => enabled;

/** Current loudness 0..1 (RMS), gated: whispering is always safe. */
export function micLoudness(): number {
  if (!analyser || !data) return 0;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i]! - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  const scaled = Math.min(1, rms * 3.2); // normalize typical speech into 0..1
  return scaled < MIC_GATE ? 0 : scaled;
}

export function disableMic(): void {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  ctx?.close().catch(() => undefined);
  ctx = null;
  analyser = null;
  data = null;
  enabled = false;
}
