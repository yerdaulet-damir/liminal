// The complete wire contract. Both network edges parse these unions before using them.

export const CHAT_TEXT_MAX = 180;
export const CHAT_HISTORY_MAX = 30;
export const CLIENT_FRAME_MAX = 1_024;
export const SERVER_FRAME_MAX = 16_384;

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  z: number;
  ry: number;
  down: boolean;
  reviveP: number;
  /** How much noise this player is MAKING right now, 0..1 (footsteps ∪ creaky floor ∪ voice),
   *  before distance and walls. Broadcast so both players can see who is being loud — the
   *  mechanic has to be visible to be learnable. */
  noise: number;
  /** True when that noise actually reaches the creature. Loud is survivable; heard is not. */
  heard: boolean;
}

export interface EntityState {
  x: number;
  z: number;
  mood: "calm" | "stalk" | "hunt" | "retreat";
}

export interface ChatMessage {
  seq: number;
  senderId: string;
  senderName: string;
  text: string;
}

export type Phase = "playing" | "won" | "lost";

export type ClientMsg =
  | { t: "join"; name: string; lastVersion: number }
  | { t: "move"; x: number; z: number; ry: number; lit?: boolean; mic?: number }
  | { t: "grab"; id: number }
  | { t: "restart" }
  | { t: "chat"; text: string };

export type ServerMsg =
  | { t: "welcome"; selfId: string; seed: number; version: number }
  | {
      t: "state";
      version: number;
      phase: Phase;
      level: number;
      outage: boolean;
      keysLeft: number[];
      players: PlayerState[];
      entity: EntityState;
    }
  | { t: "chat_state"; version: number; messages: ChatMessage[] }
  | { t: "chat"; message: ChatMessage }
  | { t: "room_full" };

export type MatchClientMsg =
  | { t: "find_match" }
  | { t: "cancel_match" }
  | { t: "match_ack"; roomId: string };

export type MatchServerMsg =
  /** You are now the open game: anyone pressing Quick Play joins you. `waiting` includes you. */
  | { t: "match_waiting"; waiting: number }
  | { t: "match_found"; roomId: string };

export type WireMsg = ClientMsg | ServerMsg | MatchClientMsg | MatchServerMsg;

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isVersion = (value: unknown): value is number =>
  isNum(value) && Number.isInteger(value) && value >= 0;
const isRoomId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;

function decodeObject(raw: string, maxLength: number): JsonObject | null {
  if (raw.length > maxLength) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function parsePlayer(value: unknown): PlayerState | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isNum(value.x) ||
    !isNum(value.z) ||
    !isNum(value.ry) ||
    typeof value.down !== "boolean" ||
    !isNum(value.reviveP)
  ) {
    return null;
  }
  const noise = isNum(value.noise) ? Math.max(0, Math.min(1, value.noise)) : 0;
  const heard = value.heard === true;
  return {
    id: value.id,
    name: value.name,
    x: value.x,
    z: value.z,
    ry: value.ry,
    down: value.down,
    reviveP: value.reviveP,
    noise,
    heard,
  };
}

function parseEntity(value: unknown): EntityState | null {
  if (!isObject(value) || !isNum(value.x) || !isNum(value.z)) return null;
  if (!["calm", "stalk", "hunt", "retreat"].includes(String(value.mood))) return null;
  return { x: value.x, z: value.z, mood: value.mood as EntityState["mood"] };
}

function parseChatMessage(value: unknown): ChatMessage | null {
  if (!isObject(value) || !isVersion(value.seq)) return null;
  if (
    typeof value.senderId !== "string" ||
    typeof value.senderName !== "string" ||
    typeof value.text !== "string" ||
    value.text.length === 0 ||
    value.text.length > CHAT_TEXT_MAX
  ) {
    return null;
  }
  return {
    seq: value.seq,
    senderId: value.senderId,
    senderName: value.senderName,
    text: value.text,
  };
}

function parseState(data: JsonObject): ServerMsg | null {
  if (!isVersion(data.version) || !isVersion(data.level) || typeof data.outage !== "boolean") {
    return null;
  }
  if (!["playing", "won", "lost"].includes(String(data.phase))) return null;
  if (!Array.isArray(data.keysLeft) || !data.keysLeft.every(isVersion)) return null;
  if (!Array.isArray(data.players)) return null;
  const players = data.players.map(parsePlayer);
  if (players.some((player) => player === null)) return null;
  const entity = parseEntity(data.entity);
  if (!entity) return null;
  return {
    t: "state",
    version: data.version,
    phase: data.phase as Phase,
    level: data.level,
    outage: data.outage,
    keysLeft: data.keysLeft,
    players: players as PlayerState[],
    entity,
  };
}

export function parseClientMsg(raw: string): ClientMsg | null {
  const data = decodeObject(raw, CLIENT_FRAME_MAX);
  if (!data) return null;
  if (data.t === "join" && typeof data.name === "string" && isVersion(data.lastVersion)) {
    return { t: "join", name: data.name.slice(0, 24), lastVersion: data.lastVersion };
  }
  if (data.t === "move" && isNum(data.x) && isNum(data.z) && isNum(data.ry)) {
    const mic = isNum(data.mic) ? Math.max(0, Math.min(1, data.mic)) : 0;
    return { t: "move", x: data.x, z: data.z, ry: data.ry, lit: data.lit === true, mic };
  }
  if (data.t === "grab" && isNum(data.id)) return { t: "grab", id: Math.floor(data.id) };
  if (data.t === "restart") return { t: "restart" };
  if (data.t === "chat" && typeof data.text === "string") {
    const text = data.text.trim().slice(0, CHAT_TEXT_MAX);
    return text.length > 0 ? { t: "chat", text } : null;
  }
  return null;
}

export function parseServerMsg(raw: string): ServerMsg | null {
  const data = decodeObject(raw, SERVER_FRAME_MAX);
  if (!data) return null;
  if (
    data.t === "welcome" &&
    typeof data.selfId === "string" &&
    isNum(data.seed) &&
    isVersion(data.version)
  ) {
    return { t: "welcome", selfId: data.selfId, seed: data.seed, version: data.version };
  }
  if (data.t === "state") return parseState(data);
  if (data.t === "chat") {
    const message = parseChatMessage(data.message);
    return message ? { t: "chat", message } : null;
  }
  if (data.t === "chat_state" && isVersion(data.version) && Array.isArray(data.messages)) {
    const messages = data.messages.map(parseChatMessage);
    if (messages.some((message) => message === null) || messages.length > CHAT_HISTORY_MAX) return null;
    return { t: "chat_state", version: data.version, messages: messages as ChatMessage[] };
  }
  return data.t === "room_full" ? { t: "room_full" } : null;
}

export function parseMatchClientMsg(raw: string): MatchClientMsg | null {
  const data = decodeObject(raw, CLIENT_FRAME_MAX);
  if (!data) return null;
  if (data.t === "find_match") return { t: "find_match" };
  if (data.t === "cancel_match") return { t: "cancel_match" };
  if (data.t === "match_ack" && isRoomId(data.roomId)) {
    return { t: "match_ack", roomId: data.roomId };
  }
  return null;
}

export function parseMatchServerMsg(raw: string): MatchServerMsg | null {
  const data = decodeObject(raw, SERVER_FRAME_MAX);
  if (!data) return null;
  if (data.t === "match_waiting") {
    const waiting = typeof data.waiting === "number" && Number.isFinite(data.waiting)
      ? Math.max(1, Math.floor(data.waiting))
      : 1;
    return { t: "match_waiting", waiting };
  }
  if (data.t === "match_found" && isRoomId(data.roomId)) {
    return { t: "match_found", roomId: data.roomId };
  }
  return null;
}

export const encode = (message: WireMsg): string => JSON.stringify(message);
