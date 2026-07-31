import type * as Party from "partykit/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TICK_MS,
  encode,
  parseServerMsg,
  type Maze,
  type ServerMsg,
} from "@liminal/shared";
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
    storage: { get: vi.fn(), put: vi.fn() },
    broadcast: vi.fn(() => {
      throw new Error("room.broadcast must not include rejected or closed sockets");
    }),
  } as unknown as Party.Room;
  return { server: new GameRoom(room), room };
}

function stateMessages(player: Party.Connection): Extract<ServerMsg, { t: "state" }>[] {
  return vi.mocked(player.send).mock.calls.flatMap(([raw]) => {
    const message = typeof raw === "string" ? parseServerMsg(raw) : null;
    return message?.t === "state" ? [message] : [];
  });
}

function join(server: GameRoom, player: Party.Connection, resumeToken?: string): void {
  server.onConnect(player);
  server.onMessage(
    encode({ t: "join", name: "one", lastVersion: 0, ...(resumeToken ? { resumeToken } : {}) }),
    player,
  );
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

    join(server, player);
    expect(player.send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(TICK_MS);
    const first = vi.mocked(player.send).mock.calls[0]?.[0];
    expect(typeof first === "string" ? parseServerMsg(first) : null).toMatchObject({
      t: "welcome",
      selfId: expect.stringMatching(/^p_/),
    });
  });

  it("caps gameplay room admission at two players on the tick", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const players = [connection("p1"), connection("p2"), connection("p3")];

    for (const player of players) join(server, player);
    vi.advanceTimersByTime(TICK_MS);

    const rejected = vi.mocked(players[2]!.send).mock.calls
      .map(([raw]) => (typeof raw === "string" ? parseServerMsg(raw) : null))
      .find((message) => message?.t === "room_full");
    expect(rejected).toEqual({ t: "room_full" });
    expect(players[2]!.close).toHaveBeenCalled();
  });

  it("advances from the Poolrooms to the dead mall on the authoritative tick", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const player = connection("p1");
    join(server, player);
    vi.advanceTimersByTime(TICK_MS);

    Reflect.set(server, "level", 2);
    Reflect.set(server, "keys", []);
    const maze = Reflect.get(server, "maze") as Maze;
    const roster = Reflect.get(server, "players") as Map<string, { x: number; z: number }>;
    const authoritativePlayer = roster.values().next().value!;
    authoritativePlayer.x = maze.thinWall.x;
    authoritativePlayer.z = maze.thinWall.z;

    expect(stateMessages(player).at(-1)?.level).toBe(0);
    vi.advanceTimersByTime(TICK_MS);
    expect(stateMessages(player).at(-1)).toMatchObject({
      phase: "playing",
      level: 3,
      outage: false,
    });
    expect((Reflect.get(server, "maze") as Maze).zones?.map((zone) => zone.kind)).toEqual([
      "atrium",
      "food-court",
      "storefront-loop",
      "service-wing",
    ]);
  });

  it("restarts a completed dead mall run at the lobby on the tick", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const player = connection("p1");
    join(server, player);
    vi.advanceTimersByTime(TICK_MS);
    Reflect.set(server, "level", 3);
    Reflect.set(server, "phase", "won");

    server.onMessage(encode({ t: "restart" }), player);
    expect(Reflect.get(server, "level")).toBe(3);
    vi.advanceTimersByTime(TICK_MS);

    expect(stateMessages(player).at(-1)).toMatchObject({
      phase: "playing",
      level: 0,
    });
  });

  it("requires every admitted player to vote before restarting a terminal run", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const first = connection("transport-1");
    const second = connection("transport-2");
    join(server, first);
    join(server, second);
    vi.advanceTimersByTime(TICK_MS);
    Reflect.set(server, "phase", "lost");

    server.onMessage(encode({ t: "restart" }), first);
    vi.advanceTimersByTime(TICK_MS);
    expect(stateMessages(first).at(-1)?.phase).toBe("lost");

    server.onMessage(encode({ t: "restart" }), second);
    vi.advanceTimersByTime(TICK_MS);
    expect(stateMessages(first).at(-1)?.phase).toBe("playing");
  });

  it("resumes the same server-issued identity with its bearer token", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const first = connection("transport-1");
    join(server, first);
    vi.advanceTimersByTime(TICK_MS);
    const welcomeRaw = vi.mocked(first.send).mock.calls[0]?.[0];
    const welcome = typeof welcomeRaw === "string" ? parseServerMsg(welcomeRaw) : null;
    expect(welcome?.t).toBe("welcome");
    if (welcome?.t !== "welcome") throw new Error("missing welcome");

    server.onClose(first);
    vi.advanceTimersByTime(TICK_MS);
    const resumed = connection("transport-2");
    join(server, resumed, welcome.resumeToken);
    vi.advanceTimersByTime(TICK_MS);
    const resumedRaw = vi.mocked(resumed.send).mock.calls[0]?.[0];
    expect(typeof resumedRaw === "string" ? parseServerMsg(resumedRaw) : null).toMatchObject({
      t: "welcome",
      selfId: welcome.selfId,
    });
  });

  it("applies accepted movement through authoritative wall collision", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const player = connection("transport-1");
    join(server, player);
    vi.advanceTimersByTime(TICK_MS);
    const roster = Reflect.get(server, "players") as Map<string, { x: number; z: number }>;
    const authoritativePlayer = roster.values().next().value!;
    const start = { x: authoritativePlayer.x, z: authoritativePlayer.z };
    Reflect.set(server, "maze", {
      cols: 2,
      rows: 2,
      cell: 4,
      walls: [{ x: start.x + 0.3, z: start.z, w: 0.2, d: 4 }],
      open: [],
      start,
      exit: { x: 6, z: 6 },
      thinWall: { x: 8, z: 6, w: 0.3, d: 4 },
    } satisfies Maze);
    Reflect.set(server, "keys", [{ id: 0, x: 6, z: 6 }]);
    Reflect.set(server, "props", []);

    server.onMessage(encode({ t: "move", x: start.x + 0.6, z: start.z, ry: 0 }), player);
    vi.advanceTimersByTime(TICK_MS);
    expect(authoritativePlayer).toMatchObject(start);
  });

  it("publishes only the server-drained flashlight state", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const player = connection("transport-1");
    join(server, player);
    vi.advanceTimersByTime(TICK_MS);
    Reflect.set(server, "level", 1);

    server.onMessage(encode({ t: "move", x: 2, z: 2, ry: 0, lit: true }), player);
    vi.advanceTimersByTime(TICK_MS);
    expect(stateMessages(player).at(-1)?.players[0]).toMatchObject({
      lit: true,
      flashlightS: expect.closeTo(90 - TICK_MS / 1000),
    });
  });

  it("fails closed when durable state says the authoritative instance restarted", async () => {
    vi.useFakeTimers();
    const room = {
      id: "restarted-room",
      storage: { get: vi.fn().mockResolvedValue(true), put: vi.fn() },
    } as unknown as Party.Room;
    const server = new GameRoom(room);
    await server.onStart();
    const player = connection("transport-1");
    join(server, player);
    vi.advanceTimersByTime(TICK_MS);

    const messages = vi.mocked(player.send).mock.calls.map(([raw]) =>
      typeof raw === "string" ? parseServerMsg(raw) : null,
    );
    expect(messages).toContainEqual({ t: "room_unavailable" });
    expect(player.close).toHaveBeenCalled();
  });

  it("caps unauthenticated pending handshakes", () => {
    vi.useFakeTimers();
    const { server } = harness();
    const pending = Array.from({ length: 9 }, (_, index) => connection(`pending-${index}`));
    for (const player of pending) server.onConnect(player);
    vi.advanceTimersByTime(TICK_MS);
    expect(pending[8]!.close).toHaveBeenCalledWith(1008, "handshake capacity exceeded");
  });
});
