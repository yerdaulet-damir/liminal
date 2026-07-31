// Doors that lead nowhere and people who are still here. Placement is deterministic (shared),
// so both players walk past the same wrong thing in the same wrong position.

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { placeDressing, type DoorKind, type FigurePose } from "@liminal/shared";
import { levelWorld } from "./levelWorld.js";

const DOOR_URL: Record<DoorKind, string> = {
  single: "/models/Door_1.glb",
  wide: "/models/Door_Double.glb",
  battered: "/models/Door_5.glb",
};

const FIGURE_URLS = [
  "/models/figure_Suit.glb",
  "/models/figure_Worker.glb",
  "/models/figure_Casual.glb",
  "/models/figure_Punk.glb",
];

[...Object.values(DOOR_URL), ...FIGURE_URLS].forEach((u) => useGLTF.preload(u));

export function Dressing({ seed, level = 0 }: { seed: number; level?: number }) {
  const { maze } = levelWorld(seed, level);
  const dressing = useMemo(() => placeDressing(seed, maze, level), [seed, maze, level]);

  return (
    <group>
      {dressing.doors.map((d, i) => (
        <Model key={`d${i}`} url={DOOR_URL[d.kind]} x={d.x} z={d.z} rotY={d.rotY} height={2.1} />
      ))}
      {dressing.figures.map((f, i) => (
        <Figure key={`f${i}`} url={FIGURE_URLS[f.model % FIGURE_URLS.length]!} {...f} />
      ))}
    </group>
  );
}

/** Normalizes any pack's arbitrary units to a target height, then places it. */
function useNormalized(url: string, targetHeight: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    // packs export at wildly different units (these figures are ~38–45 units tall, the doors
    // ~4.2) — measure precisely and normalize, or a body renders as a speck on the carpet
    clone.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(clone, true);
    const h = box.max.y - box.min.y;
    return { clone, scale: h > 0 ? targetHeight / h : 1 };
  }, [scene, targetHeight]);
}

function Model({
  url,
  x,
  z,
  rotY,
  height,
}: {
  url: string;
  x: number;
  z: number;
  rotY: number;
  height: number;
}) {
  const { clone, scale } = useNormalized(url, height);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <primitive object={clone} scale={scale} />
    </group>
  );
}

/** The poses. Each one is a body doing something a body does not do. */
const POSE_TRANSFORM: Record<
  FigurePose,
  { rot: [number, number, number]; y: number }
> = {
  "facing-wall": { rot: [0, 0, 0], y: 0 },
  "upside-down": { rot: [Math.PI, 0, 0], y: 1.85 },
  collapsed: { rot: [-Math.PI / 2, 0, 0.35], y: 0.12 },
  sunken: { rot: [0, 0, 0], y: -0.85 },
  leaning: { rot: [0, 0, 0.42], y: 0.05 },
};

function Figure({
  url,
  pose,
  x,
  z,
  rotY,
}: {
  url: string;
  pose: FigurePose;
  x: number;
  z: number;
  rotY: number;
}) {
  const { clone, scale } = useNormalized(url, 1.8);
  const t = POSE_TRANSFORM[pose];
  const grey = useMemo(() => {
    // drained of colour: they have been here longer than the wallpaper
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.color.lerp(new THREE.Color("#6b6555"), 0.65);
      m.roughness = 0.95;
      mesh.material = m;
    });
    return clone;
  }, [clone]);

  return (
    <group position={[x, t.y, z]} rotation={[t.rot[0], rotY, t.rot[2]]}>
      <primitive object={grey} scale={scale} />
    </group>
  );
}
