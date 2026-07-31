import { describe, expect, it } from "vitest";
import { createRoomId, roomIdFromSearch, roomUrl } from "./roomLinks.js";

describe("private room links", () => {
  it("creates an opaque identifier accepted by invitation parsing", () => {
    const roomId = createRoomId();

    expect(roomId).toMatch(/^[A-Za-z0-9_-]{20,128}$/);
    expect(roomIdFromSearch(`?room=${roomId}`)).toBe(roomId);
  });

  it("rejects legacy short and malformed room identifiers", () => {
    expect(roomIdFromSearch("?room=abc123")).toBeNull();
    expect(roomIdFromSearch(`?room=${"a".repeat(20)}%2Fadmin`)).toBeNull();
    expect(roomIdFromSearch("?room=")).toBeNull();
  });

  it("does not copy host overrides or unrelated parameters into invitations", () => {
    const roomId = "a".repeat(32);

    expect(roomUrl(roomId, "https://liminal.game/play?host=evil.example&utm_source=x#frag"))
      .toBe(`https://liminal.game/play?room=${roomId}`);
  });

  it("refuses to build a link for an invalid identifier", () => {
    expect(() => roomUrl("not-valid", "https://liminal.game/")).toThrow(
      "Invalid private room identifier",
    );
  });
});
