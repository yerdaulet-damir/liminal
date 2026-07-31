// Feedback for the game's main verb. Picking up a key used to change one number in a corner
// and nothing else — less confirmation than a spreadsheet cell. Both players get the chime and
// the flash, because "did you get it?" should never need asking.

import { useEffect, useRef, useState } from "react";
import { KEYS_PER_LEVEL } from "@liminal/shared";
import { playPickup, playUnlocked } from "../audio/cues.js";
import type { Room } from "../net/useRoom.js";
import "./key-pulse.css";

export function KeyPulse({ room }: { room: Room }) {
  const [banner, setBanner] = useState<string | null>(null);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const left = room.keysLeft.length;
    const before = previous.current;
    previous.current = left;
    // only fire on an actual pickup, never on join or on a level reset that adds keys back
    if (before === null || left >= before) return;

    const found = KEYS_PER_LEVEL - left;
    if (left === 0) {
      playUnlocked();
      setBanner("the way out is thin now");
    } else {
      playPickup();
      setBanner(`${found} / ${KEYS_PER_LEVEL}`);
    }
    const timer = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(timer);
  }, [room.keysLeft]);

  if (banner === null) return null;
  return (
    <div className="key-pulse" role="status" aria-live="polite">
      <span>{banner}</span>
    </div>
  );
}
