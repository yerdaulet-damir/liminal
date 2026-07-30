import type * as Party from "partykit/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TICK_MS, encode, parseServerMsg } from "@liminal/shared";
import GameRoom from "./room.js";

function connection(id: string): Party.Connection {
  return {
    id,
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as Party.Connection;
}

function harness(): { server: GameRoom; room: Party.Room } {
  const room = {
    id: "test-room",
    broadcast: vi.fn(() => {
      throw new Error("room.broadcast must not include rejected or closed sockets");
    }),
  } as unknown as Party.Room;
  return { server: new GameRoom(room), room };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("GameRoom authority", () => {
  it("defers admission and client messages until the authoritative tick", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const player = connection("p1");

    server.onConnect(player);
    server.onMessage(encode({ t: "join", name: "one", lastVersion: 0 }), player);
    expect(player.send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(TICK_MS);
    const first = vi.mocked(player.send).mock.calls[0]?.[0];
    expect(typeof first === "string" ? parseServerMsg(first) : null).toMatchObject({
      t: "welcome",
      selfId: "p1",
    });
  });

  it("caps gameplay room admission at two players on the tick", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const players = [connection("p1"), connection("p2"), connection("p3")];

    for (const player of players) server.onConnect(player);
    vi.advanceTimersByTime(TICK_MS);

    const rejected = vi.mocked(players[2]!.send).mock.calls
      .map(([raw]) => (typeof raw === "string" ? parseServerMsg(raw) : null))
      .find((message) => message?.t === "room_full");
    expect(rejected).toEqual({ t: "room_full" });
    expect(players[2]!.close).toHaveBeenCalled();
  });
});
