import type * as Party from "partykit/server";
import { describe, expect, it } from "vitest";
import { CommandQueue } from "./commands.js";

const connection = { id: "player" } as Party.Connection;

describe("CommandQueue lifecycle priority", () => {
  it("coalesces movement to the latest request per player and keeps lifecycle priority", () => {
    const queue = new CommandQueue();
    for (let index = 0; index < 256; index += 1) {
      expect(
        queue.enqueue({
          kind: "message",
          senderId: "player",
          message: { t: "move", x: index, z: 0, ry: 0 },
        }),
      ).toBe(true);
    }

    queue.enqueueLifecycle({ kind: "disconnect", connection });
    const commands = queue.drain();

    expect(commands[0]).toEqual({ kind: "disconnect", connection });
    expect(commands).toHaveLength(2);
    expect(commands[1]).toMatchObject({ message: { t: "move", x: 255 } });
  });

  it("bounds discrete commands per sender without starving another sender", () => {
    const queue = new CommandQueue();
    let accepted = 0;
    for (let index = 0; index < 256; index += 1) {
      if (queue.enqueue({ kind: "message", senderId: "flooder", message: { t: "grab", id: index } })) {
        accepted += 1;
      }
    }

    expect(accepted).toBeLessThan(256);
    expect(queue.enqueue({ kind: "message", senderId: "honest", message: { t: "restart" } })).toBe(true);
    expect(queue.drain()).toContainEqual({
      kind: "message",
      senderId: "honest",
      message: { t: "restart" },
    });
  });

  it("preserves reconnect lifecycle ordering for sockets sharing an id", () => {
    const queue = new CommandQueue();

    queue.enqueueLifecycle({ kind: "connect", connection });
    queue.enqueueLifecycle({ kind: "disconnect", connection });

    expect(queue.drain()).toEqual([
      { kind: "connect", connection },
      { kind: "disconnect", connection },
    ]);
  });
});
