// The keys you must find before the wall lets you through. They hum and pulse — the only
// friendly light in the level. Positions come from shared (same list the server validates).

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PICKUP_DIST } from "@liminal/shared";
import { levelWorld } from "./levelWorld.js";
import type { Room } from "../net/useRoom.js";

export function Keys({ seed, room }: { seed: number; room: Room }) {
  const all = useMemo(() => levelWorld(seed, 0).keys, [seed]);
  const left = all.filter((k) => room.keysLeft.includes(k.id));
  return (
    <>
      {left.map((k) => (
        <KeyPickup key={k.id} id={k.id} x={k.x} z={k.z} room={room} />
      ))}
    </>
  );
}

function KeyPickup({ id, x, z, room }: { id: number; x: number; z: number; room: Room }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const lastGrabAttemptS = useRef(-Infinity);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = t * 1.2;
    ref.current.position.y = 1 + Math.sin(t * 2) * 0.08;
    // Retry while nearby: the first grab can reach the room before the latest movement packet.
    const nearby = Math.hypot(camera.position.x - x, camera.position.z - z) < PICKUP_DIST;
    if (nearby && t - lastGrabAttemptS.current >= 0.25) {
      lastGrabAttemptS.current = t;
      room.sendGrab(id);
    }
  });

  return (
    <group ref={ref} position={[x, 1, z]}>
      <mesh>
        <torusGeometry args={[0.13, 0.035, 8, 20]} />
        <meshStandardMaterial color="#f7e7a0" emissive="#ffd24a" emissiveIntensity={1.4} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.05, 0.34, 0.05]} />
        <meshStandardMaterial color="#f7e7a0" emissive="#ffd24a" emissiveIntensity={1.2} metalness={0.7} roughness={0.3} />
      </mesh>
      <pointLight color="#ffcf5a" intensity={2.2} distance={4.5} decay={2} />
    </group>
  );
}
