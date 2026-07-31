import { useEffect, useRef, useState } from "react";
import { useQuickPlay } from "../net/useQuickPlay.js";
import { JoinPanel } from "./JoinPanel.js";
import { LandingStory } from "./LandingStory.js";
import { createRoomId, roomIdFromLocation, roomUrl } from "./roomLinks.js";
import "./lobby.css";

interface LobbyProps {
  onPlay: (name: string, roomId: string, couch?: boolean) => void;
}

export function Lobby({ onPlay }: LobbyProps) {
  const existingRoom = roomIdFromLocation();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const quickPlay = useQuickPlay();
  const enteredMatch = useRef<string | null>(null);

  useEffect(() => {
    if (quickPlay.status !== "matched" || !quickPlay.roomId) return;
    if (enteredMatch.current === quickPlay.roomId) return;

    enteredMatch.current = quickPlay.roomId;
    history.replaceState(null, "", roomUrl(quickPlay.roomId));
    onPlay(name.trim() || "player", quickPlay.roomId);
  }, [name, onPlay, quickPlay.roomId, quickPlay.status]);

  const playPrivate = () => {
    const roomId = existingRoom ?? createRoomId();
    if (!existingRoom) {
      const url = roomUrl(roomId);
      history.replaceState(null, "", url);
      navigator.clipboard?.writeText(url).then(
        () => setCopied(true),
        () => undefined,
      );
    }
    onPlay(name.trim() || "player", roomId);
  };

  // Same room, no link to send: both players sit at this laptop and split the screen.
  const playCouch = () => onPlay(name.trim() || "player", existingRoom ?? createRoomId(), true);

  return (
    <main className="landing">
      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__image" aria-hidden="true" />
        <div className="landing__shade" aria-hidden="true" />
        <header className="landing__header">
          <a className="landing__brand" href="#top" aria-label="Liminal home">
            LIMINAL
          </a>
          <span className="landing__edition">Two-player browser horror</span>
        </header>

        <div className="landing__hero-copy" id="top">
          <p className="landing__signal">Your friend is already inside.</p>
          <h1 id="landing-title">
            Stay close.
            <br />
            Stay quiet.
          </h1>
          <p className="landing__intro">
            Four impossible places. One private link. Something in the dark listens when you speak.
          </p>
        </div>

        <JoinPanel
          copied={copied}
          existingRoom={existingRoom}
          name={name}
          quickPlay={quickPlay}
          onNameChange={setName}
          onPlayCouch={playCouch}
          onPlayPrivate={playPrivate}
        />
      </section>
      <LandingStory />
    </main>
  );
}
