import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { creatureOf, type CreatureSkin } from "@liminal/shared";
import type { Room } from "../net/useRoom.js";

// Same rules, different body. Which one you meet is decided by the seed in shared/bestiary,
// so both players are hunted by the same shape.
const SKIN_URL: Record<CreatureSkin, string> = {
  creep: "/models/monster.glb",
  demon: "/models/monster_Demon.gltf",
  "blue-demon": "/models/monster_BlueDemon.gltf",
  orc: "/models/monster_Orc.gltf",
};

function findClip(names: string[], wanted: RegExp, fallback: RegExp): string | null {
  return (
    names.find((name) => wanted.test(name)) ??
    names.find((name) => fallback.test(name)) ??
    names[0] ??
    null
  );
}

export function Creep({ room, seed }: { room: Room; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const creature = creatureOf(seed, room.level) ?? { skin: "creep" as const, height: 2.3 };
  const { scene, animations } = useGLTF(SKIN_URL[creature.skin]);
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
    return { cloned: model, scale: height > 0 ? creature.height / height : 1 };
  }, [scene, creature.height]);
  const { actions, names } = useAnimations(animations, ref);
  const currentClip = useRef<string | null>(null);

  const renderMood = (mood: string) => {
    // one clip vocabulary across packs: the quadruped ships Walk1/Walk2/Sniff, the humanoids
    // ship Walk/Run/Idle, so each mood asks for both spellings before falling back.
    const wanted =
      mood === "hunt"
        ? findClip(names, /run|walk2/i, /walk/i)
        : mood === "stalk"
          ? findClip(names, /walk1|^walk$/i, /walk/i)
          : findClip(names, /sniff|idle/i, /idle/i);
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
