import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { encode, parseMatchServerMsg } from "@liminal/shared";
import { partyHost, stableSocketId } from "./socketConfig.js";

export type QuickPlayStatus = "idle" | "searching" | "matched";

export interface QuickPlay {
  status: QuickPlayStatus;
  /** How many players are holding an open game right now (including you). */
  waiting: number;
  roomId: string | null;
  findMatch: () => void;
  cancelMatch: () => void;
}

export function useQuickPlay(): QuickPlay {
  const [status, setStatus] = useState<QuickPlayStatus>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const socketRef = useRef<PartySocket | null>(null);

  const cancelMatch = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode({ t: "cancel_match" }));
    socket?.close();
    socketRef.current = null;
    setStatus("idle");
    setRoomId(null);
    setWaiting(0);
  }, []);

  const findMatch = useCallback(() => {
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(encode({ t: "find_match" }));
      }
      setStatus("searching");
      return;
    }
    const socket = new PartySocket({
      host: partyHost(),
      party: "matchmaking",
      room: "quick-play",
      id: stableSocketId("matchmaking.quick-play"),
      maxEnqueuedMessages: 0,
    });
    socketRef.current = socket;
    setStatus("searching");
    socket.addEventListener("open", () => socket.send(encode({ t: "find_match" })));
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      const message = parseMatchServerMsg(event.data);
      if (!message) return;
      if (message.t === "match_waiting") {
        setStatus("searching");
        setWaiting(message.waiting);
        return;
      }
      socket.send(encode({ t: "match_ack", roomId: message.roomId }));
      setRoomId(message.roomId);
      setStatus("matched");
    });
  }, []);

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, waiting, roomId, findMatch, cancelMatch };
}
