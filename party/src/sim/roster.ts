import type * as Party from "partykit/server";
import { TICK_MS, encode, type ChatMessage, type PlayerState } from "@liminal/shared";

const MAX_PLAYERS = 2;
const RECONNECT_GRACE_TICKS = 30 * (1000 / TICK_MS);

interface AdmissionState {
  players: Map<string, PlayerState>;
  connections: Map<string, Party.Connection>;
  disconnectedAt: Map<string, number>;
  start: { x: number; z: number };
  seed: number;
  version: number;
  chat: { version: number; messages: ChatMessage[] };
}

interface ExpiryState {
  players: Map<string, PlayerState>;
  disconnectedAt: Map<string, number>;
  prevPos: Map<string, { x: number; z: number }>;
  lit: Map<string, boolean>;
  mic: Map<string, number>;
  tick: number;
}

export function admitConnection(state: AdmissionState, connection: Party.Connection): void {
  const existing = state.players.get(connection.id);
  if (!existing && state.players.size >= MAX_PLAYERS) {
    connection.send(encode({ t: "room_full" }));
    connection.close(1008, "room full");
    return;
  }
  if (!existing) {
    state.players.set(connection.id, {
      id: connection.id,
      name: "player",
      x: state.start.x,
      z: state.start.z,
      ry: 0,
      down: false,
      reviveP: 0,
      noise: 0,
      heard: false,
    });
  }
  state.connections.set(connection.id, connection);
  state.disconnectedAt.delete(connection.id);
  connection.send(
    encode({ t: "welcome", selfId: connection.id, seed: state.seed, version: state.version }),
  );
  connection.send(encode({ t: "chat_state", ...state.chat }));
}

export function expireDisconnected(state: ExpiryState): void {
  for (const [id, disconnectedTick] of state.disconnectedAt) {
    if (state.tick - disconnectedTick < RECONNECT_GRACE_TICKS) continue;
    state.players.delete(id);
    state.prevPos.delete(id);
    state.lit.delete(id);
    state.mic.delete(id);
    state.disconnectedAt.delete(id);
  }
}
