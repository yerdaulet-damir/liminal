// Couch co-op: two players, one laptop, one room. Each seat is a full client — its own socket,
// its own camera, its own HUD — so the server sees a perfectly ordinary two-player game and
// nothing about the wire contract or the room tick changes.

import { Game } from "./Game.js";
import "./couch.css";

const SEATS = [
  { seat: 0, tag: "P1 · WASD + mouse", name: "P1" },
  { seat: 1, tag: "P2 · arrows / gamepad", name: "P2" },
] as const;

export function CouchGame({ roomId }: { roomId: string }) {
  return (
    <div className="couch">
      {SEATS.map((s) => (
        <div className="couch__seat" key={s.seat}>
          <Game name={s.name} roomId={roomId} seat={s.seat} />
          <span className="couch__tag">{s.tag}</span>
        </div>
      ))}
    </div>
  );
}
