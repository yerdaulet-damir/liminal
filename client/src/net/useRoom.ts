// Client net layer — the Anti-Corruption boundary. The ONLY place that talks to the socket and
// turns wire messages into local state. The scene reads `stateRef` (a ref, no re-render storm);
// the roster id list is React state so meshes are created/removed declaratively.

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import {
  encode,
  parseServerMsg,
  type ChatMessage,
  type EntityState,
  type Phase,
  type PlayerState,
} from "@liminal/shared";
import { ChatStore } from "./chatState.js";
import { partyHost, stableSocketId } from "./socketConfig.js";

export interface RoomState {
  players: PlayerState[];
  entity: EntityState;
}

export interface Room {
  welcome: { selfId: string; seed: number } | null;
  admissionError: "room-full" | null;
  stateRef: React.MutableRefObject<RoomState | null>;
  ids: string[];
  phase: Phase;
  level: number;
  outage: boolean;
  keysLeft: number[];
  selfDown: boolean;
  partnerDown: boolean;
  chatMessages: ChatMessage[];
  sendMove: (x: number, z: number, ry: number, lit?: boolean, mic?: number) => void;
  sendGrab: (id: number) => void;
  sendRestart: () => void;
  sendChat: (text: string) => void;
}

/** `seat` separates two local players sharing one browser — each needs its own socket id. */
export function useRoom(roomId: string, name: string, seat = 0): Room {
  const [welcome, setWelcome] = useState<Room["welcome"]>(null);
  const [admissionError, setAdmissionError] = useState<Room["admissionError"]>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [level, setLevel] = useState(0);
  const [outage, setOutage] = useState(false);
  const [keysLeft, setKeysLeft] = useState<number[]>([]);
  const keysKey = useRef("");
  const [selfDown, setSelfDown] = useState(false);
  const [partnerDown, setPartnerDown] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const selfIdRef = useRef<string | null>(null);
  const lastVersionRef = useRef(0);
  const stateRef = useRef<RoomState | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const idsKey = useRef("");

  useEffect(() => {
    const chat = new ChatStore();
    lastVersionRef.current = 0;
    const ps = new PartySocket({
      host: partyHost(),
      room: roomId,
      id: stableSocketId(`game.${roomId}.${seat}`),
      maxEnqueuedMessages: 0,
    });
    socketRef.current = ps;

    ps.addEventListener("open", () =>
      ps.send(encode({ t: "join", name, lastVersion: lastVersionRef.current })),
    );
    ps.addEventListener("message", (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      const msg = parseServerMsg(e.data);
      if (!msg) return;
      if (msg.t === "welcome") {
        setAdmissionError(null);
        selfIdRef.current = msg.selfId;
        setWelcome({ selfId: msg.selfId, seed: msg.seed });
      } else if (msg.t === "state") {
        if (msg.version <= lastVersionRef.current) return;
        lastVersionRef.current = msg.version;
        stateRef.current = { players: msg.players, entity: msg.entity };
        setPhase(msg.phase);
        setLevel(msg.level);
        setOutage(msg.outage);
        const kk = msg.keysLeft.join(",");
        if (kk !== keysKey.current) {
          keysKey.current = kk;
          setKeysLeft(msg.keysLeft);
        }
        setSelfDown(msg.players.some((p) => p.id === selfIdRef.current && p.down));
        setPartnerDown(msg.players.some((p) => p.id !== selfIdRef.current && p.down));
        const key = msg.players.map((p) => p.id).sort().join("|");
        if (key !== idsKey.current) {
          idsKey.current = key;
          setIds(msg.players.map((p) => p.id));
        }
      } else if (msg.t === "chat_state") {
        if (chat.applyState(msg.version, msg.messages)) setChatMessages(chat.state().messages);
      } else if (msg.t === "chat") {
        if (chat.applyEvent(msg.message)) setChatMessages(chat.state().messages);
      } else if (msg.t === "room_full") {
        setAdmissionError("room-full");
        ps.close(1000, "room full");
        if (socketRef.current === ps) socketRef.current = null;
      }
    });

    return () => ps.close();
  }, [roomId, name, seat]);

  const sendMove = useCallback((x: number, z: number, ry: number, lit = false, mic = 0) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(encode({ t: "move", x, z, ry, lit, mic }));
    }
  }, []);
  const sendGrab = useCallback((id: number) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode({ t: "grab", id }));
  }, []);
  const sendRestart = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode({ t: "restart" }));
  }, []);
  const sendChat = useCallback((text: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode({ t: "chat", text }));
  }, []);

  return {
    welcome,
    admissionError,
    stateRef,
    ids,
    phase,
    level,
    outage,
    keysLeft,
    selfDown,
    partnerDown,
    chatMessages,
    sendMove,
    sendGrab,
    sendRestart,
    sendChat,
  };
}
