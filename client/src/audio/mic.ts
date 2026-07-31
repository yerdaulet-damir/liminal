// The microphone as a game input: the entity hears your real voice.
// Local analysis only — we never transmit audio, just one loudness byte per tick.
// (Voice CHAT is a separate concern; this works with players on Discord too.)

import { MIC_GATE } from "@liminal/shared";

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let data: Uint8Array<ArrayBuffer> | null = null;
let mediaStream: MediaStream | null = null;
let enabled = false;
let requestVersion = 0;
let pendingEnable: Promise<boolean> | null = null;

const stopStream = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

async function requestMic(version: number): Promise<boolean> {
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    if (version !== requestVersion) {
      stopStream(stream);
      return false;
    }

    audioContext = new AudioContext();
    const src = audioContext.createMediaStreamSource(stream);
    const nextAnalyser = audioContext.createAnalyser();
    nextAnalyser.fftSize = 512;
    src.connect(nextAnalyser);

    mediaStream = stream;
    ctx = audioContext;
    analyser = nextAnalyser;
    data = new Uint8Array(new ArrayBuffer(nextAnalyser.frequencyBinCount));
    enabled = true;
    return true;
  } catch {
    stopStream(stream);
    audioContext?.close().catch(() => undefined);
    return false;
  }
}

/** Ask for the mic. Returns false if denied — the game plays on without it. */
export function enableMic(): Promise<boolean> {
  if (enabled) return Promise.resolve(true);
  if (pendingEnable) return pendingEnable;

  const request = requestMic(requestVersion);
  pendingEnable = request.finally(() => {
    if (pendingEnable === requestWithCleanup) pendingEnable = null;
  });
  const requestWithCleanup = pendingEnable;
  return requestWithCleanup;
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
  requestVersion++;
  pendingEnable = null;
  stopStream(mediaStream);
  mediaStream = null;
  ctx?.close().catch(() => undefined);
  ctx = null;
  analyser = null;
  data = null;
  enabled = false;
}
