// Thin render edge for received actors. Positions and moods come only from the room snapshot.

import type { Room } from "../net/useRoom.js";
import { Creep } from "./Creep.js";
import { MallWatcher } from "./DeadMall/MallWatcher.js";
import { RemotePlayer } from "./RemotePlayer.js";
import { useEntityAudio } from "./useEntityAudio.js";

export function Actors({ room, seed, seat = 0 }: { room: Room; seed: number; seat?: number }) {
  useEntityAudio(room, seat);
  const others = room.ids.filter((id) => id !== room.welcome?.selfId);
  return (
    <>
      {others.map((id, index) => (
        <RemotePlayer key={id} id={id} room={room} slot={index} />
      ))}
      {(room.level === 0 || room.level === 1) && <Creep room={room} seed={seed} />}
      {room.level === 3 && <MallWatcher room={room} />}
    </>
  );
}
