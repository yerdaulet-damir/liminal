// The mechanic, made visible. The creature hunts noise, so the players must be able to SEE
// noise — theirs and their partner's. Polls the snapshot ref at 20 fps, which is smooth for a
// bar and far cheaper than re-rendering the tree on every tick.

import { useEffect, useState } from "react";
import { MIC_GATE, MIC_LOUD } from "@liminal/shared";
import type { Room } from "../net/useRoom.js";
import "./noise-meter.css";

interface Reading {
  noise: number;
  heard: boolean;
  name: string;
}

interface Levels {
  self: Reading;
  partner: Reading | null;
}

const QUIET: Reading = { noise: 0, heard: false, name: "you" };

export function NoiseMeter({ room }: { room: Room }) {
  const [levels, setLevels] = useState<Levels>({ self: QUIET, partner: null });
  const selfId = room.welcome?.selfId;

  useEffect(() => {
    const id = setInterval(() => {
      const players = room.stateRef.current?.players ?? [];
      const self = players.find((p) => p.id === selfId);
      const partner = players.find((p) => p.id !== selfId);
      setLevels({
        self: { noise: self?.noise ?? 0, heard: self?.heard ?? false, name: "you" },
        partner: partner
          ? { noise: partner.noise, heard: partner.heard, name: partner.name }
          : null,
      });
    }, 50);
    return () => clearInterval(id);
  }, [room, selfId]);

  return (
    <div className="noise" aria-hidden="true">
      <Bar reading={levels.self} />
      {levels.partner ? <Bar reading={levels.partner} /> : null}
    </div>
  );
}

// The bar is how much noise you MAKE. The colour is whether it reached the creature —
// being loud in an empty wing is fine; being heard is the thing that kills you.
function Bar({ reading }: { reading: Reading }) {
  const state = reading.heard
    ? "heard"
    : reading.noise >= MIC_LOUD
      ? "loud"
      : reading.noise >= MIC_GATE
        ? "audible"
        : "quiet";
  return (
    <div className={`noise__row noise__row--${state}`}>
      <span className="noise__label">{reading.name}</span>
      <span className="noise__track">
        <i style={{ width: `${Math.min(100, reading.noise * 100)}%` }} />
        {/* the gate: below this mark nothing can hear you, however close it is */}
        <b style={{ left: `${MIC_GATE * 100}%` }} />
      </span>
      <span className="noise__flag">{reading.heard ? "heard" : ""}</span>
    </div>
  );
}
