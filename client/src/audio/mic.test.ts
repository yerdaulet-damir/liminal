import { afterEach, describe, expect, it, vi } from "vitest";
import { disableMic, enableMic, micEnabled } from "./mic.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function streamWith(stop: ReturnType<typeof vi.fn>): MediaStream {
  return { getTracks: () => [{ stop }] } as unknown as MediaStream;
}

function installAudioContext(close = vi.fn().mockResolvedValue(undefined)): void {
  const analyser = { fftSize: 0, frequencyBinCount: 256 };
  const source = { connect: vi.fn() };
  const audioContext = {
    close,
    createAnalyser: () => analyser,
    createMediaStreamSource: () => source,
  };
  vi.stubGlobal("AudioContext", vi.fn(() => audioContext));
}

afterEach(() => {
  disableMic();
  vi.unstubAllGlobals();
});

describe("microphone lifecycle", () => {
  it("shares one browser request across concurrent enables", async () => {
    const permission = deferred<MediaStream>();
    const getUserMedia = vi.fn(() => permission.promise);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    installAudioContext();

    const first = enableMic();
    const second = enableMic();
    expect(second).toBe(first);
    expect(getUserMedia).toHaveBeenCalledOnce();

    permission.resolve(streamWith(vi.fn()));
    await expect(first).resolves.toBe(true);
    expect(micEnabled()).toBe(true);
  });

  it("stops a late stream resolved after disable without enabling", async () => {
    const permission = deferred<MediaStream>();
    const stop = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(() => permission.promise) },
    });
    installAudioContext();

    const result = enableMic();
    disableMic();
    permission.resolve(streamWith(stop));

    await expect(result).resolves.toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(micEnabled()).toBe(false);
    expect(AudioContext).not.toHaveBeenCalled();
  });

  it("stops active tracks and closes the audio context", async () => {
    const stopFirst = vi.fn();
    const stopSecond = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopFirst }, { stop: stopSecond }],
        }),
      },
    });
    installAudioContext(close);

    await expect(enableMic()).resolves.toBe(true);
    disableMic();

    expect(stopFirst).toHaveBeenCalledOnce();
    expect(stopSecond).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(micEnabled()).toBe(false);
  });
});
