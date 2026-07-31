import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import type { Room } from "../net/useRoom.js";

useGLTF.preload("/models/monster.glb");

function findClip(names: string[], wanted: RegExp, fallback: RegExp): string | null {
  return (
    names.find((name) => wanted.test(name)) ??
    names.find((name) => fallback.test(name)) ??
    names[0] ??
    null
  );
}

export function Creep({ room }: { room: Room }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const { scene, animations } = useGLTF("/models/monster.glb");
  const { cloned, scale } = useMemo(() => {
    const model = SkeletonUtils.clone(scene);
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      material.color.set("#161210");
      material.roughness = 0.5;
      mesh.material = material;
    });
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    return { cloned: model, scale: height > 0 ? 2.3 / height : 1 };
  }, [scene]);
  const { actions, names } = useAnimations(animations, ref);
  const currentClip = useRef<string | null>(null);

  const renderMood = (mood: string) => {
    const wanted =
      mood === "hunt"
        ? findClip(names, /walk2/i, /walk/i)
        : mood === "stalk"
          ? findClip(names, /walk1/i, /walk/i)
          : findClip(names, /sniff/i, /idle/i);
    if (wanted === currentClip.current) return;
    if (currentClip.current) actions[currentClip.current]?.fadeOut(0.25);
    const action = wanted ? actions[wanted] : undefined;
    action?.reset().fadeIn(0.25).play();
    if (action) action.timeScale = mood === "hunt" ? 1.6 : 1;
    currentClip.current = wanted;
  };

  useFrame(() => {
    const entity = room.stateRef.current?.entity;
    if (!entity || !ref.current) return;
    target.current.set(entity.x, 0, entity.z);
    ref.current.position.lerp(target.current, 0.2);
    ref.current.lookAt(camera.position.x, 0, camera.position.z);
    renderMood(entity.mood);
    if (location.search.includes("watch")) camera.lookAt(entity.x, 1.6, entity.z);
  });

  return <primitive ref={ref} object={cloned} scale={scale} />;
}
