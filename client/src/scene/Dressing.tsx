// Doors that lead nowhere and people who are still here. Placement is deterministic (shared),
// so both players walk past the same wrong thing in the same wrong position.

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { placeDressing, type DoorKind, type FigurePlacement } from "@liminal/shared";
import { applyPose } from "./figurePose.js";
import { Smilers } from "./Smiler.js";
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

export function Dressing({
  seed,
  level = 0,
  worldLevel,
  artLevel,
}: {
  seed: number;
  /** @deprecated Pass worldLevel and artLevel separately. */
  level?: number;
  worldLevel?: number;
  artLevel?: number;
}) {
  const resolvedWorldLevel = worldLevel ?? level;
  const resolvedArtLevel = artLevel ?? level;
  const { maze } = levelWorld(seed, resolvedWorldLevel, resolvedArtLevel);
  const dressing = useMemo(
    () =>
      resolvedWorldLevel === 3
        ? { doors: [], figures: [], smilers: [] }
        : placeDressing(seed, maze, resolvedArtLevel),
    [seed, maze, resolvedWorldLevel, resolvedArtLevel],
  );

  return (
    <group>
      {dressing.doors.map((d, i) => (
        <Model key={`d${i}`} url={DOOR_URL[d.kind]} x={d.x} z={d.z} rotY={d.rotY} height={2.1} />
      ))}
      {dressing.figures.map((f, i) => (
        <Figure key={`f${i}`} url={FIGURE_URLS[f.model % FIGURE_URLS.length]!} place={f} />
      ))}
      <Smilers places={dressing.smilers} />
    </group>
  );
}

/**
 * Normalizes any pack's arbitrary units to a target height, then places it.
 *
 * `precise` is required, not optional. These figures are skinned meshes whose raw geometry sits
 * in a space nothing like the posed body — measured loosely, one came out 196 units deep and the
 * whole person was scaled down to a speck on the carpet. Precise mode walks the vertices through
 * the skeleton and measures the body you actually see.
 */
function useNormalized(url: string, targetHeight: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(clone, true);
    const h = box.max.y - box.min.y;
    const scale = h > 0 ? targetHeight / h : 1;
    const bone = (want: string) => {
      let found: THREE.Object3D | null = null;
      clone.traverse((o) => { if (!found && o.name.toLowerCase() === want) found = o; });
      return found ? (found as THREE.Object3D).getWorldPosition(new THREE.Vector3()) : null;
    };
    const head = bone("head"), foot = bone("footl");
    console.log("BODY", url, "boxH", h.toFixed(2), "scale", scale.toFixed(4),
      "headY", head ? (head.y * scale).toFixed(2) : "-", "footY", foot ? (foot.y * scale).toFixed(2) : "-",
      "rootScale", clone.scale.toArray().join(","), "children", clone.children.length);
    return { clone, scale };
  }, [scene, targetHeight, url]);
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

const DEAD_TONE = new THREE.Color("#6b6555");

function Figure({ url, place }: { url: string; place: FigurePlacement }) {
  const { clone, scale } = useNormalized(url, 1.8);
  const { posed, spec } = useMemo(() => {
    // drained of colour: they have been here longer than the wallpaper, and not all the same
    // length of time — `drain` is per-figure, so a congregation reads as one age, not one prop.
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      material.color.lerp(DEAD_TONE, place.drain);
      material.roughness = 0.95;
      mesh.material = material;
    });
    return { posed: clone, spec: applyPose(clone, place.pose) };
  }, [clone, place.drain, place.pose]);

  return (
    <group position={[place.x, spec.y, place.z]} rotation={[spec.root[0], place.rotY, spec.root[1]]}>
      <primitive object={posed} scale={scale} />
    </group>
  );
}
