// Minimal in-game HUD: connection state + how many are in the maze with you. Reflects net
// state honestly (reconnection is first-class). No game logic here.

import type React from "react";
import { useEffect, useState } from "react";
import { levelLore } from "@liminal/shared";
import type { Room } from "../net/useRoom.js";
import { bindingFor } from "../player/inputScheme.js";
import { flashlightFor } from "../player/flashlight.js";

export function Hud({ room, seat = 0 }: { room: Room; seat?: number }) {
  const flashlight = flashlightFor(seat);
  const tank = bindingFor(seat).tank; // the arrow-cluster seat has its own key legend
  const connected = !!room.welcome;
  const count = room.ids.length;
  // poll the flashlight store (it lives outside React on purpose)
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(iv);
  }, []);
  const batteryPct = Math.round((flashlight.batteryS / 90) * 100);
  return (
    <>
      <div style={S.wrap}>
        <span style={{ color: connected ? "#9fd17a" : "#d1a14a" }}>
          {connected ? "● connected" : "○ connecting…"}
        </span>
        <span style={S.sep}>·</span>
        <span>{count} in the maze</span>
        <span style={S.sep}>·</span>
        <span>{`level ${room.level} · ${levelLore(room.level).name.toLowerCase()}`}</span>
        <span style={S.sep}>·</span>
        <span style={{ color: room.keysLeft.length ? "#f7e7a0" : "#9fd17a" }}>
          🔑 {3 - room.keysLeft.length}/3
        </span>
        {room.level === 1 && (
          <>
            <span style={S.sep}>·</span>
            <span style={{ color: flashlight.on ? "#f4e8a0" : "#6a6448" }}>
              🔦 {batteryPct}% ({tank ? "." : "F"})
            </span>
          </>
        )}
        <span style={S.sep}>·</span>
        <span style={S.dim}>
          {tank
            ? "walk over glowing keys · ↑↓ walk · ←→ turn · right-shift sprint · / crouch"
            : "walk over glowing keys · m chat · shift sprint · c crouch · esc cursor"}
        </span>
      </div>
      {room.phase === "playing" && !room.selfDown && !room.partnerDown && (
        <div style={{ ...S.banner, bottom: 100, opacity: 0.75 }}>
          {room.keysLeft.length
            ? `find ${room.keysLeft.length} more key${room.keysLeft.length > 1 ? "s" : ""} where the halls narrow — walk over the glow`
            : "the wall is thin now. listen for the hum."}
        </div>
      )}
      {room.outage && room.phase === "playing" && (
        <div style={{ ...S.banner, bottom: 64 }}>
          <span style={{ color: "#ff5a5a" }}>power outage</span> — it moves faster in the dark.
          light your way.
        </div>
      )}
      {room.selfDown && (
        <div style={S.banner}>
          <span style={{ color: "#ff5a5a" }}>you are down</span> — your partner can revive you.
          stay quiet.
        </div>
      )}
      {!room.selfDown && room.partnerDown && (
        <div style={S.banner}>
          <span style={{ color: "#ffb84a" }}>your partner is down</span> — reach them and stay
          close to revive.
        </div>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    top: 12,
    left: 12,
    padding: "6px 12px",
    fontSize: 12,
    background: "rgba(10,10,8,0.6)",
    border: "1px solid #3a3520",
    borderRadius: 8,
    color: "#cfc8a8",
    pointerEvents: "none",
    userSelect: "none",
  },
  sep: { margin: "0 8px", color: "#5a5436" },
  dim: { color: "#6a6448" },
  banner: {
    position: "fixed",
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    fontSize: 13,
    background: "rgba(10,10,8,0.75)",
    border: "1px solid #3a3520",
    borderRadius: 8,
    color: "#cfc8a8",
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
};
