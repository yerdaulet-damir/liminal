import type * as Party from "partykit/server";
import { describe, expect, it } from "vitest";
import { CommandQueue } from "./commands.js";

const connection = { id: "player" } as Party.Connection;

describe("CommandQueue lifecycle priority", () => {
  it("keeps the latest lifecycle event even when gameplay input is saturated", () => {
    const queue = new CommandQueue();
    for (let index = 0; index < 256; index += 1) {
      expect(
        queue.enqueue({ kind: "message", senderId: "player", message: { t: "restart" } }),
      ).toBe(true);
    }

    queue.enqueueLifecycle({ kind: "disconnect", connection });
    const commands = queue.drain();

    expect(commands[0]).toEqual({ kind: "disconnect", connection });
    expect(commands).toHaveLength(257);
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
