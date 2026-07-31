import { describe, expect, it } from "vitest";
import { MAX_ASSIGNMENTS, MAX_WAITING, MatchQueue } from "./queue.js";

describe("MatchQueue", () => {
  it("leaves an odd player waiting and pairs the next player once", () => {
    const queue = new MatchQueue(() => "opaque-room");

    expect(queue.find("a")).toEqual({ kind: "waiting" });
    expect(queue.find("b")).toEqual({ kind: "paired", tickets: ["a", "b"], roomId: "opaque-room" });
    expect(queue.find("a")).toEqual({ kind: "assigned", roomId: "opaque-room" });
    expect(queue.find("b")).toEqual({ kind: "assigned", roomId: "opaque-room" });
    expect(queue.snapshot().waiting).toEqual([]);
  });

  it("does not double-pair repeated find requests", () => {
    let roomCount = 0;
    const queue = new MatchQueue(() => `room-${++roomCount}`);

    queue.find("a");
    queue.find("a");
    queue.find("b");
    expect(queue.find("a")).toEqual({ kind: "assigned", roomId: "room-1" });
    expect(roomCount).toBe(1);
  });

  it("cancels waiting players and preserves matched assignments across disconnect", () => {
    const queue = new MatchQueue(() => "room-1");

    queue.find("a");
    queue.cancel("a");
    expect(queue.snapshot().waiting).toEqual([]);

    queue.find("a");
    queue.find("b");
    queue.disconnect("a");
    expect(queue.find("a")).toEqual({ kind: "assigned", roomId: "room-1" });
    queue.acknowledge("a", "room-1");
    expect(queue.snapshot().assignments.a).toBeUndefined();
  });

  it("expires abandoned assignments after the reconnect lease", () => {
    let now = 1_000;
    const queue = new MatchQueue(() => "room-1", undefined, () => now);

    queue.find("a");
    queue.find("b");
    now += 120_001;

    expect(queue.find("a")).toEqual({ kind: "waiting" });
    expect(queue.snapshot().assignments).toEqual({});
  });

  it("reconciles stale waiters without discarding acknowledged assignments", () => {
    const queue = new MatchQueue(() => "room-2", {
      waiting: ["gone", "live"],
      assignments: { matched: { roomId: "room-1", expiresAt: Date.now() + 60_000 } },
    });

    queue.reconcile(new Set(["live"]));
    expect(queue.snapshot()).toEqual({
      waiting: ["live"],
      assignments: expect.objectContaining({
        matched: expect.objectContaining({ roomId: "room-1" }),
      }),
    });
  });

  it("bounds restored state and rejects pairing when assignment capacity is exhausted", () => {
    const assignments = Object.fromEntries(
      Array.from({ length: MAX_ASSIGNMENTS + 20 }, (_, index) => [
        `ticket-${index}`,
        { roomId: `room-${index}`, expiresAt: 10_000 },
      ]),
    );
    const queue = new MatchQueue(
      () => "new-room",
      {
        waiting: Array.from({ length: MAX_WAITING + 20 }, (_, index) => `waiting-${index}`),
        assignments,
      },
      () => 0,
    );

    expect(queue.snapshot().waiting).toHaveLength(MAX_WAITING);
    expect(Object.keys(queue.snapshot().assignments)).toHaveLength(MAX_ASSIGNMENTS);
    expect(queue.find("newcomer")).toEqual({ kind: "rejected" });
    expect(queue.snapshot().waiting).toHaveLength(MAX_WAITING);
  });

  it("does not mark repeated no-op requests as persistence mutations", () => {
    const queue = new MatchQueue(() => "room-1");
    queue.find("a");
    const revision = queue.revision;
    queue.find("a");
    expect(queue.revision).toBe(revision);
  });
});
