import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_MAX, TICK_HZ } from "@liminal/shared";
import { ChatLedger } from "./chat.js";

describe("ChatLedger", () => {
  it("commits sequence-numbered messages and rate-limits by tick", () => {
    const chat = new ChatLedger();

    expect(chat.commit("p1", "one", "first", 1)?.seq).toBe(1);
    expect(chat.commit("p1", "one", "too soon", 1)).toBeNull();
    expect(chat.commit("p1", "one", "later", 1 + TICK_HZ)?.seq).toBe(2);
  });

  it("keeps bounded history for reconnect snapshots", () => {
    const chat = new ChatLedger();
    for (let index = 0; index < CHAT_HISTORY_MAX + 5; index += 1) {
      chat.commit(`p${index}`, "one", `message-${index}`, index);
    }

    const state = chat.state();
    expect(state.messages).toHaveLength(CHAT_HISTORY_MAX);
    expect(state.version).toBe(CHAT_HISTORY_MAX + 5);
    expect(state.messages[0]?.seq).toBe(6);
  });
});
