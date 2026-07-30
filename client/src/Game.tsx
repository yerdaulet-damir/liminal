import type React from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { levelSeed } from "@liminal/shared";
import { useRoom } from "./net/useRoom.js";
import { ChatPanel } from "./ui/ChatPanel.js";
import { Hud } from "./ui/Hud.js";
import { EndOverlay } from "./ui/EndOverlay.js";
import { Maze } from "./scene/Maze.js";
import { Props } from "./scene/Props.js";
import { Keys } from "./scene/Keys.js";
import { Lighting } from "./scene/Lighting.js";
import { Actors } from "./scene/Actors.js";
import { Player } from "./player/Player.js";
import "./game.css";

export function Game({ name, roomId }: { name: string; roomId: string }) {
  const room = useRoom(roomId, name);
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

  const levelOverride = new URLSearchParams(location.search).get("level");
  const level = levelOverride !== null ? Number(levelOverride) : room.level;
  const seed = levelSeed(room.welcome.seed, level);
  const dark = level === 1;
  const pool = level >= 2;
  const bg = pool ? "#cfe8f2" : dark ? "#0a0b0b" : "#cfc188";
  const levelName = pool ? "the poolrooms" : dark ? "the warehouse" : "the lobby";

  return (
    <main className="game-shell">
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 60 }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[bg]} />
        <Suspense fallback={null}>
          <Lighting level={level} outage={room.outage} />
          <Maze seed={seed} level={level} unlocked={room.keysLeft.length === 0} />
          <Props seed={seed} level={level} />
          <Keys seed={seed} room={room} />
          <Actors room={room} />
          <Player
            key={level}
            seed={seed}
            level={level}
            sendMove={room.sendMove}
            frozen={room.phase !== "playing" || room.selfDown || falling}
            roundEnded={room.phase !== "playing"}
            unlocked={room.keysLeft.length === 0}
          />
        </Suspense>
      </Canvas>
      <Hud room={room} />
      <ChatPanel room={room} />
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
