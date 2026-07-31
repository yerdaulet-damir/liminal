import { lazy, Suspense, useEffect, useState } from "react";
import { trackLandingView } from "./analytics.js";
import { Lobby } from "./ui/Lobby.js";

const Game = lazy(() => import("./Game.js").then((module) => ({ default: module.Game })));
const CouchGame = lazy(() =>
  import("./CouchGame.js").then((module) => ({ default: module.CouchGame })),
);

interface Session {
  name: string;
  roomId: string;
  /** both players on this laptop, split screen */
  couch: boolean;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(trackLandingView, []);

  if (!session) {
    return <Lobby onPlay={(name, roomId, couch = false) => setSession({ name, roomId, couch })} />;
  }
  return (
    <Suspense fallback={<div style={loadingStyle}>opening the passage...</div>}>
      {session.couch ? (
        <CouchGame roomId={session.roomId} />
      ) : (
        <Game name={session.name} roomId={session.roomId} />
      )}
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
