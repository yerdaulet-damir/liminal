import { describe, expect, it } from "vitest";
import { ChatStore } from "./chatState.js";

const message = (seq: number) => ({
  seq,
  senderId: "p1",
  senderName: "one",
  text: `message-${seq}`,
});

describe("ChatStore", () => {
  it("ignores stale events and snapshots", () => {
    const store = new ChatStore();

    expect(store.applyState(3, [message(2), message(3)])).toBe(true);
    expect(store.applyEvent(message(2))).toBe(false);
    expect(store.applyState(2, [message(2)])).toBe(false);
    expect(store.state()).toEqual({ version: 3, messages: [message(2), message(3)] });
  });

  it("resyncs from a newer full snapshot after an event gap", () => {
    const store = new ChatStore();

    expect(store.applyEvent(message(2))).toBe(false);
    expect(store.applyState(2, [message(1), message(2)])).toBe(true);
    expect(store.applyEvent(message(3))).toBe(true);
    expect(store.state().version).toBe(3);
  });
});
