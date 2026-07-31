import { TICK_HZ } from "@liminal/shared";

export class RoomLog {
  private lastRejectionTick = -Infinity;
  private readonly lastEventTick = new Map<string, number>();

  event(event: string, details: Record<string, string | number> = {}): void {
    console.info(JSON.stringify({ event, ...details }));
  }

  bounded(event: string, tick: number): void {
    const last = this.lastEventTick.get(event) ?? -Infinity;
    if (tick - last < TICK_HZ) return;
    this.lastEventTick.set(event, tick);
    this.event(event);
  }

  rejection(event: string, tick: number): void {
    if (tick - this.lastRejectionTick < TICK_HZ) return;
    this.lastRejectionTick = tick;
    this.event(event);
  }
}
