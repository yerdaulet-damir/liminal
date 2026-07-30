import { lazy, Suspense, useState } from "react";
import { Lobby } from "./ui/Lobby.js";

const Game = lazy(() => import("./Game.js").then((module) => ({ default: module.Game })));

export function App() {
  const [session, setSession] = useState<{ name: string; roomId: string } | null>(null);

  if (!session) {
    return <Lobby onPlay={(name, roomId) => setSession({ name, roomId })} />;
  }
  return (
    <Suspense fallback={<div style={loadingStyle}>opening the passage...</div>}>
      <Game name={session.name} roomId={session.roomId} />
    </Suspense>
  );
}

const loadingStyle = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "#0a0a08",
  color: "#b3a878",
  fontSize: 14,
  letterSpacing: 2,
} as const;
