import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Room } from "../../net/useRoom.js";

function Limb({
  position,
  rotation = [0, 0, 0],
  length,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <capsuleGeometry args={[0.105, length, 7, 10]} />
      <meshStandardMaterial color="#d8d4c9" roughness={0.68} />
    </mesh>
  );
}

export function MallWatcher({ room }: { room: Room }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useFrame(() => {
    const entity = room.stateRef.current?.entity;
    if (!entity || !ref.current) return;
    target.current.set(entity.x, 0, entity.z);
    ref.current.position.lerp(target.current, entity.mood === "hunt" ? 0.23 : 0.16);
    ref.current.lookAt(camera.position.x, 1.3, camera.position.z);
    ref.current.rotation.z = entity.mood === "stalk" ? 0.08 : 0;
    ref.current.scale.y = entity.mood === "hunt" ? 1.08 : 1;
    if (location.search.includes("watch")) camera.lookAt(entity.x, 1.45, entity.z);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.235, 16, 14]} />
        <meshStandardMaterial color="#ded9cc" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.13, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.62, 8, 12]} />
        <meshStandardMaterial color="#d3cec2" roughness={0.7} />
      </mesh>
      <Limb position={[-0.34, 1.1, 0]} rotation={[0, 0, -0.12]} length={0.72} />
      <Limb position={[0.34, 1.1, 0]} rotation={[0, 0, 0.12]} length={0.72} />
      <Limb position={[-0.15, 0.39, 0]} length={0.78} />
      <Limb position={[0.15, 0.39, 0]} length={0.78} />
      {[[-0.29, 1.42], [0.29, 1.42], [-0.15, 0.82], [0.15, 0.82]].map(([x, y]) => (
        <mesh key={`${x}:${y}`} position={[x!, y!, 0]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#b9b3a8" roughness={0.74} />
        </mesh>
      ))}
    </group>
  );
}
