import { useState } from "react";
import { disableMic, enableMic } from "../audio/mic.js";
import "./quick-play.css";

type MicState = "off" | "on" | "denied";
type QuickPlayState = {
  status: "idle" | "searching" | "matched";
  /** Open games right now, including yours while you wait. */
  waiting: number;
  findMatch: () => void;
  cancelMatch: () => void;
};

interface JoinPanelProps {
  copied: boolean;
  existingRoom: string | null;
  name: string;
  quickPlay: QuickPlayState;
  onNameChange: (name: string) => void;
  onPlayCouch: () => void;
  onPlayPrivate: () => void;
}

export function JoinPanel({
  copied,
  existingRoom,
  name,
  quickPlay,
  onNameChange,
  onPlayCouch,
  onPlayPrivate,
}: JoinPanelProps) {
  const [mic, setMic] = useState<MicState>("off");
  const isSearching = quickPlay.status === "searching";

  const toggleMic = async () => {
    if (mic === "on") {
      disableMic();
      setMic("off");
      return;
    }
    setMic((await enableMic()) ? "on" : "denied");
  };

  const micLabel =
    mic === "on"
      ? "Microphone on. Turn it off"
      : mic === "denied"
        ? "Microphone blocked. Footsteps still make noise."
        : "Let the creature hear your microphone";

  return (
    <form
      className="landing__join"
      onSubmit={(event) => {
        event.preventDefault();
        onPlayPrivate();
      }}
    >
      <p className="landing__join-status">
        {existingRoom ? "Private invitation detected" : "Open a private passage"}
      </p>
      <label htmlFor="player-name">What should your partner call you?</label>
      <input
        id="player-name"
        autoComplete="nickname"
        autoFocus
        maxLength={24}
        placeholder="Enter your name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
      />
      <button
        className={`landing__mic landing__mic--${mic}`}
        type="button"
        aria-pressed={mic === "on"}
        onClick={() => void toggleMic()}
      >
        <span className="landing__mic-dot" aria-hidden="true" />
        {micLabel}
      </button>
      <button className="landing__play" type="submit" disabled={isSearching}>
        {existingRoom ? "Join your friend" : "Create a private game"}
        <span aria-hidden="true">↗</span>
      </button>

      <div className="landing__or" aria-hidden="true">
        <span>or</span>
      </div>
      {isSearching ? (
        <div className="landing__search" role="status" aria-live="polite">
          <span>
            <i aria-hidden="true" />
            {quickPlay.waiting > 1
              ? `Your door is open. ${quickPlay.waiting} doors open right now…`
              : "Your door is open. Waiting for someone to walk in…"}
          </span>
          <button type="button" onClick={quickPlay.cancelMatch}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="landing__quick"
          type="button"
          disabled={quickPlay.status === "matched"}
          onClick={quickPlay.findMatch}
        >
          <span>
            <strong>Quick play</strong>
            Open your game to a stranger, or walk into theirs
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      <button className="landing__quick" type="button" onClick={onPlayCouch}>
        <span>
          <strong>One laptop, two players</strong>
          Split the screen. P1 mouse + WASD, P2 arrows or a gamepad
        </span>
        <span aria-hidden="true">▯▯</span>
      </button>
      <p className="landing__privacy">
        Microphone stays local. Anonymous analytics never include names, chat, or room links.
      </p>
      <p className="landing__copied" role="status" aria-live="polite">
        {copied ? "Invite link copied. Send it to your friend." : "\u00a0"}
      </p>
    </form>
  );
}
