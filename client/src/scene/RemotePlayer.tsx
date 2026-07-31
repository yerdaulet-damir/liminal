import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import type { Room } from "../net/useRoom.js";

const CHARACTERS = ["/models/player1.glb", "/models/player2.glb"];

function findClip(names: string[], wanted: RegExp, fallback: RegExp): string | null {
  return (
    names.find((name) => wanted.test(name)) ??
    names.find((name) => fallback.test(name)) ??
    names[0] ??
    null
  );
}

export function RemotePlayer({ id, room, slot }: { id: string; room: Room; slot: number }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const { scene, animations } = useGLTF(CHARACTERS[slot % CHARACTERS.length]!);
  const { cloned, scale } = useMemo(() => {
    const model = SkeletonUtils.clone(scene);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    return { cloned: model, scale: height > 0 ? 1.8 / height : 1 };
  }, [scene]);
  const { actions, names } = useAnimations(animations, ref);
  const currentClip = useRef<string | null>(null);

  useFrame(() => {
    const player = room.stateRef.current?.players.find((value) => value.id === id);
    if (!player || !ref.current) return;
    target.current.set(player.x, 0, player.z);
    const moving = ref.current.position.distanceToSquared(target.current) > 0.0144 && !player.down;
    ref.current.position.lerp(target.current, 0.25);
    ref.current.rotation.set(player.down ? -Math.PI / 2 + 0.12 : 0, player.ry + Math.PI, 0);
    const wanted = player.down
      ? null
      : moving
        ? findClip(names, /walk/i, /run/i)
        : findClip(names, /idle/i, /pose/i);
    if (wanted === currentClip.current) return;
    if (currentClip.current) actions[currentClip.current]?.fadeOut(0.2);
    if (wanted) actions[wanted]?.reset().fadeIn(0.2).play();
    currentClip.current = wanted;
  });

  return <primitive ref={ref} object={cloned} scale={scale} />;
}
