// Power outages — Level 1's heartbeat. Its own little state machine so the tick stays readable.

import { OUTAGE_EVERY_MAX_S, OUTAGE_EVERY_MIN_S, OUTAGE_S, type Rng } from "@liminal/shared";

export class Outage {
  dark = false;
  private timerS = 0;
  private nextS = OUTAGE_EVERY_MIN_S;

  reset(rng: Rng): void {
    this.dark = false;
    this.timerS = 0;
    this.nextS = OUTAGE_EVERY_MIN_S + rng.next() * (OUTAGE_EVERY_MAX_S - OUTAGE_EVERY_MIN_S);
  }

  tick(dtS: number, rng: Rng): void {
    this.timerS += dtS;
    if (!this.dark && this.timerS >= this.nextS) {
      this.dark = true;
      this.timerS = 0;
    } else if (this.dark && this.timerS >= OUTAGE_S) {
      this.dark = false;
      this.timerS = 0;
      this.nextS = OUTAGE_EVERY_MIN_S + rng.next() * (OUTAGE_EVERY_MAX_S - OUTAGE_EVERY_MIN_S);
    }
  }
}
