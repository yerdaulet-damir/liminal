// Director state machine — the gameplay spine. Deterministic (seeded rng in).

import { describe, it, expect } from "vitest";
import { makeDirector, tickDirector, directorOnDown } from "../src/director.js";
import { makeRng } from "../src/rng.js";
import { CALM_MAX_S, HUNT_MAX_S, SUSPICION_HUNT_AT } from "../src/constants.js";

const DT = 1 / 15;
const quiet = { nearestDistU: 40, noise: 0, dtS: DT };

function run(d: ReturnType<typeof makeDirector>, senses: typeof quiet, seconds: number, rng = makeRng(7)) {
  for (let i = 0; i < seconds * 15; i++) tickDirector(d, senses, rng);
}

describe("director", () => {
  it("calm → stalk after the calm budget, never instantly", () => {
    const d = makeDirector();
    const rng = makeRng(1);
    run(d, quiet, 5, rng);
    expect(d.mood).toBe("calm");
    run(d, quiet, CALM_MAX_S, rng);
    expect(d.mood).toBe("stalk");
  });

  it("sustained loud running triggers a hunt from calm (suspicion ≥ 9)", () => {
    const d = makeDirector();
    // +1/s heard, −1/4s decay → net +0.75/s → 9 in ~12 s
    run(d, { nearestDistU: 15, noise: 0.4, dtS: DT }, SUSPICION_HUNT_AT * 2);
    expect(d.mood).toBe("hunt");
  });

  it("hunt hard-caps and retreats, and retreat clears suspicion", () => {
    const d = makeDirector();
    run(d, { nearestDistU: 15, noise: 0.4, dtS: DT }, SUSPICION_HUNT_AT * 2);
    expect(d.mood).toBe("hunt");
    run(d, { nearestDistU: 12, noise: 0.4, dtS: DT }, HUNT_MAX_S + 1);
    expect(d.mood).toBe("retreat");
    expect(d.suspicion).toBe(0);
  });

  it("camping pressure: monster near for long → menace valve sends it away (stalk → retreat)", () => {
    const d = makeDirector();
    const rng = makeRng(2);
    run(d, quiet, 41, rng); // first calm budget is exactly CALM_MIN_S → stalk just began
    expect(d.mood).toBe("stalk");
    // player near but silent and unseen-ish (dist 9: near, not seen) → menace 70 in ~35 s
    run(d, { nearestDistU: 9, noise: 0, dtS: DT }, 40, rng);
    expect(d.mood).toBe("retreat");
  });

  it("whispering is always safe, a scream is an instant hunt", () => {
    const whisper = makeDirector();
    run(whisper, { nearestDistU: 6, noise: 0.2, dtS: DT }, 60); // under the gate
    expect(whisper.suspicion).toBe(0);
    expect(whisper.mood).not.toBe("hunt");

    const scream = makeDirector();
    run(scream, { nearestDistU: 6, noise: 0.9, dtS: DT }, 1); // one second of screaming
    expect(scream.mood).toBe("hunt");
  });

  it("talking is riskier than footsteps: louder noise hunts sooner", () => {
    const talk = makeDirector();
    const steps = makeDirector();
    run(talk, { nearestDistU: 12, noise: 0.7, dtS: DT }, 5); // voice: +3/s
    run(steps, { nearestDistU: 12, noise: 0.3, dtS: DT }, 5); // walking: +1/s
    expect(talk.suspicion).toBeGreaterThan(steps.suspicion);
  });

  it("downing a player always forces retreat", () => {
    const d = makeDirector();
    run(d, { nearestDistU: 5, noise: 0.4, dtS: DT }, SUSPICION_HUNT_AT * 2);
    expect(d.mood).toBe("hunt");
    directorOnDown(d, makeRng(3));
    expect(d.mood).toBe("retreat");
  });

  it("same seed → identical mood trace (determinism)", () => {
    const trace = (seed: number) => {
      const d = makeDirector();
      const rng = makeRng(seed);
      const moods: string[] = [];
      for (let i = 0; i < 200 * 15; i++) {
        tickDirector(d, { nearestDistU: 20 - (i % 300) / 20, noise: i % 90 < 30 ? 0.4 : 0, dtS: DT }, rng);
        if (i % 150 === 0) moods.push(d.mood);
      }
      return moods.join(",");
    };
    expect(trace(42)).toEqual(trace(42));
  });
});
