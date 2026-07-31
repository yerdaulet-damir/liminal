import type React from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { levelLore, levelSeed } from "@liminal/shared";
import { useRoom } from "./net/useRoom.js";
import { ChatPanel } from "./ui/ChatPanel.js";
import { Hud } from "./ui/Hud.js";
import { EndOverlay } from "./ui/EndOverlay.js";
import { Briefing } from "./ui/Briefing.js";
import { NoiseMeter } from "./ui/NoiseMeter.js";
import { KeyPulse } from "./ui/KeyPulse.js";
import { Maze } from "./scene/Maze.js";
import { Props } from "./scene/Props.js";
import { Dressing } from "./scene/Dressing.js";
import { DevLook } from "./scene/DevLook.js";
import { Keys } from "./scene/Keys.js";
import { Lighting } from "./scene/Lighting.js";
import { Actors } from "./scene/Actors.js";
import { Player } from "./player/Player.js";
import "./game.css";

/** `seat` is set only in couch co-op (two players, one laptop) — it splits socket, input and HUD. */
export function Game({ name, roomId, seat }: { name: string; roomId: string; seat?: 0 | 1 }) {
  const couch = seat !== undefined;
  const mySeat = seat ?? 0;
  const room = useRoom(roomId, name, mySeat);
  const [falling, setFalling] = useState(false);
  const prevLevel = useRef(0);

  useEffect(() => {
    if (room.level > prevLevel.current) {
      setFalling(true);
      const timer = setTimeout(() => setFalling(false), 2600);
      return () => clearTimeout(timer);
    }
    prevLevel.current = room.level;
    return undefined;
  }, [room.level]);

  useEffect(() => {
    prevLevel.current = room.level;
  }, [room.level]);

  if (room.admissionError === "room-full") {
    const lobbyUrl = new URL(location.href);
    lobbyUrl.searchParams.delete("room");
    return (
      <div style={connectStyle}>
        <span>this passage already has two players.</span>
        <a style={retryStyle} href={`${lobbyUrl.pathname}${lobbyUrl.search}`}>
          find another room
        </a>
      </div>
    );
  }

  if (!room.welcome) {
    return <div style={connectStyle}>entering the backrooms...</div>;
  }

  // The room owns the level. `?level=N` is a dev PAINT flag only: it may re-theme the scene,
  // but geometry and keys always come from the server's level, or pickups desync.
  const levelOverride = new URLSearchParams(location.search).get("level");
  const level = room.level;
  const previewLevel = levelOverride === null ? level : Number(levelOverride);
  const artLevel = Number.isInteger(previewLevel) && previewLevel >= 0 && previewLevel <= 3
    ? previewLevel
    : level;
  const seed = levelSeed(room.welcome.seed, level);
  const bg = artLevel === 3
    ? "#222521"
    : artLevel === 2
      ? "#cfe8f2"
      : artLevel === 1 ? "#0a0b0b" : "#cfc188";
  const levelName = levelLore(level).name.toLowerCase();

  return (
    <main className="game-shell">
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 60 }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[bg]} />
        <Suspense fallback={null}>
          <Lighting level={artLevel} outage={room.outage} />
          <Maze
            seed={seed}
            worldLevel={level}
            artLevel={artLevel}
            unlocked={room.keysLeft.length === 0}
          />
          <Props seed={seed} worldLevel={level} artLevel={artLevel} />
          <Dressing seed={seed} worldLevel={level} artLevel={artLevel} />
          <Keys seed={seed} room={room} />
          <Actors room={room} seat={mySeat} />
          <DevLook />
          <Player
            key={level}
            seed={seed}
            level={level}
            seat={mySeat}
            sendMove={room.sendMove}
            frozen={room.phase !== "playing" || room.selfDown || falling}
            roundEnded={room.phase !== "playing"}
            unlocked={room.keysLeft.length === 0}
          />
        </Suspense>
      </Canvas>
      <Hud room={room} seat={mySeat} />
      <NoiseMeter room={room} />
      <KeyPulse room={room} />
      <Briefing level={level} active={room.phase === "playing" && !falling} />
      {/* on one laptop you just talk out loud — and one 'm' would open both panels */}
      {!couch && <ChatPanel room={room} />}
      <EndOverlay room={room} />
      {falling && (
        <div style={voidStyle}>
          <div style={{ fontSize: 30, letterSpacing: 10 }}>YOU FELL THROUGH</div>
          <div style={{ fontSize: 13, color: "#8a8578", marginTop: 12 }}>
            level {level} - {levelName}
          </div>
        </div>
      )}
    </main>
  );
}

const voidStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeContent: "center",
  textAlign: "center",
  background: "#000",
  color: "#cfc8a8",
  zIndex: 20,
};

const connectStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "#0a0a08",
  color: "#b3a878",
  fontSize: 14,
  letterSpacing: 2,
};

const retryStyle: React.CSSProperties = {
  marginTop: 18,
  color: "#ded47b",
  fontSize: 11,
  textTransform: "uppercase",
};
