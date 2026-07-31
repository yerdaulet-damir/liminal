import type * as Party from "partykit/server";
import { TICK_MS, encode, type ChatMessage, type PlayerState } from "@liminal/shared";

const MAX_PLAYERS = 2;
const RECONNECT_GRACE_TICKS = 30 * (1000 / TICK_MS);

export interface AdmissionState {
  players: Map<string, PlayerState>;
  connections: Map<string, Party.Connection>;
  transportPlayers: Map<string, string>;
  disconnectedAt: Map<string, number>;
  playerByToken: Map<string, string>;
  tokenByPlayer: Map<string, string>;
  start: { x: number; z: number };
  seed: number;
  version: number;
  chat: { version: number; messages: ChatMessage[] };
}

interface ExpiryState {
  players: Map<string, PlayerState>;
  disconnectedAt: Map<string, number>;
  prevPos: Map<string, { x: number; z: number }>;
  playerByToken: Map<string, string>;
  tokenByPlayer: Map<string, string>;
  tick: number;
}

function opaqueId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function sendAdmission(
  state: AdmissionState,
  connection: Party.Connection,
  playerId: string,
  resumeToken: string,
): void {
  connection.send(
    encode({
      t: "welcome",
      selfId: playerId,
      seed: state.seed,
      version: state.version,
      resumeToken,
    }),
  );
  connection.send(encode({ t: "chat_state", ...state.chat }));
}

export function admitJoin(
  state: AdmissionState,
  connection: Party.Connection,
  name: string,
  resumeToken?: string,
): { playerId: string; created: boolean } | null {
  let playerId = resumeToken ? state.playerByToken.get(resumeToken) : undefined;
  if (resumeToken && !playerId) {
    connection.send(encode({ t: "session_invalid" }));
    connection.close(1008, "invalid session");
    return null;
  }
  if (!playerId && state.players.size >= MAX_PLAYERS) {
    connection.send(encode({ t: "room_full" }));
    connection.close(1008, "room full");
    return null;
  }

  const created = !playerId;
  playerId ??= opaqueId("p");
  const token = resumeToken ?? opaqueId("r");
  if (created) {
    state.players.set(playerId, {
      id: playerId,
      name,
      x: state.start.x,
      z: state.start.z,
      ry: 0,
      down: false,
      reviveP: 0,
      noise: 0,
      heard: false,
      lit: false,
      flashlightS: 0,
    });
    state.playerByToken.set(token, playerId);
    state.tokenByPlayer.set(playerId, token);
  } else {
    state.players.get(playerId)!.name = name;
  }

  const previous = state.connections.get(playerId);
  if (previous && previous !== connection) previous.close(4001, "session resumed elsewhere");
  state.connections.set(playerId, connection);
  state.transportPlayers.set(connection.id, playerId);
  state.disconnectedAt.delete(playerId);
  sendAdmission(state, connection, playerId, token);
  return { playerId, created };
}

export function expireDisconnected(state: ExpiryState): string[] {
  const expired: string[] = [];
  for (const [id, disconnectedTick] of state.disconnectedAt) {
    if (state.tick - disconnectedTick < RECONNECT_GRACE_TICKS) continue;
    state.players.delete(id);
    state.prevPos.delete(id);
    const token = state.tokenByPlayer.get(id);
    if (token) state.playerByToken.delete(token);
    state.tokenByPlayer.delete(id);
    state.disconnectedAt.delete(id);
    expired.push(id);
  }
  return expired;
}
