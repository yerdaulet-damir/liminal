import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Room } from "../net/useRoom.js";
import { setMonsterDistance, startHeartbeat, stopHeartbeat } from "../audio/heartbeat.js";
import { setPoolMode, startAmbience, stopAmbience } from "../audio/ambience.js";
import {
  playRoar,
  playScream,
  setBreathDistance,
  startMonsterAudio,
  stopMonsterAudio,
} from "../audio/monster.js";

export function useEntityAudio(room: Room) {
  const { camera } = useThree();
  const lastMood = useRef<string>("calm");
  const wasSelfDown = useRef(false);

  useEffect(() => {
    const start = () => {
      startHeartbeat();
      void startAmbience();
      void startMonsterAudio();
    };
    window.addEventListener("pointerdown", start);
    return () => {
      window.removeEventListener("pointerdown", start);
      stopHeartbeat();
      stopAmbience();
      stopMonsterAudio();
    };
  }, []);

  useFrame(() => {
    const snapshot = room.stateRef.current;
    const entity = snapshot?.entity;
    const silent = room.level === 2 || !entity;
    setPoolMode(room.level === 2);
    const distance = silent
      ? Infinity
      : Math.hypot(camera.position.x - entity.x, camera.position.z - entity.z);
    setMonsterDistance(distance);
    setBreathDistance(distance);
    if (!entity || !snapshot) return;
    if (entity.mood !== lastMood.current && entity.mood === "hunt") playRoar();
    lastMood.current = entity.mood;
    const selfDown = snapshot.players.some(
      (player) => player.id === room.welcome?.selfId && player.down,
    );
    if (selfDown && !wasSelfDown.current) playScream();
    wasSelfDown.current = selfDown;
  });
}
