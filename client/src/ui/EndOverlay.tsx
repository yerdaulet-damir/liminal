// Win/lose overlay. The failure IS the spectacle — and the peak moment is when people share.

import type React from "react";
import { useState } from "react";
import type { Room } from "../net/useRoom.js";
import { createRoomId, roomUrl } from "./roomLinks.js";

export function EndOverlay({ room }: { room: Room }) {
  const [shared, setShared] = useState(false);
  if (room.phase === "playing") return null;
  const won = room.phase === "won";

  const share = () => {
    const url = roomUrl(createRoomId());
    const text = won
      ? `we made it out of the backrooms. think you can? ${url}`
      : `it found us in the backrooms. avenge us: ${url}`;
    navigator.clipboard?.writeText(text).then(
      () => setShared(true),
      () => undefined,
    );
  };

  return (
    <div style={{ ...S.wrap, background: won ? "rgba(6,24,10,0.88)" : "rgba(24,4,4,0.92)" }}>
      <div style={{ ...S.title, color: won ? "#2dff6a" : "#ff2222" }}>
        {won ? "YOU GOT OUT" : "IT FOUND YOU"}
      </div>
      <div style={S.sub}>
        {won ? "the exit was real. this time." : "you were loud. it listens."}
      </div>
      <button style={S.btn} onClick={() => room.sendRestart()}>
        {won ? "go back in" : "try again"}
      </button>
      <button style={S.shareBtn} onClick={share}>
        {shared ? "✓ copied — send it to a friend" : "challenge a friend"}
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    inset: 0,
    display: "grid",
    placeContent: "center",
    gap: 14,
    textAlign: "center",
    zIndex: 10,
  },
  title: { fontSize: 52, letterSpacing: 8, fontWeight: 700 },
  sub: { fontSize: 14, color: "#c9c0a0", letterSpacing: 1 },
  btn: {
    marginTop: 16,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 700,
    background: "#c9b24a",
    color: "#1a1605",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    justifySelf: "center",
  },
  shareBtn: {
    marginTop: 10,
    padding: "10px 22px",
    fontSize: 13,
    background: "transparent",
    color: "#cfc8a8",
    border: "1px solid #5a5436",
    borderRadius: 8,
    cursor: "pointer",
    justifySelf: "center",
  },
};
