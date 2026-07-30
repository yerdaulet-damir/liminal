// Set dressing — the "someone was here" layer. Furniture (KayKit CC0) and wall graffiti,
// all scattered deterministically from the seed: both players see identical decay.

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CELL, generateMaze, makeRng, placeProps, type PropKind } from "@liminal/shared";

const PROP_URL: Record<PropKind, string> = {
  chair: "/models/chair_A.gltf",
  armchair: "/models/armchair.gltf",
  cabinet: "/models/cabinet_small.gltf",
  lamp: "/models/lamp_standing.gltf",
  couch: "/models/couch.gltf",
  table: "/models/table_small.gltf",
  barrel: "/models/barrel_large.glb",
  box: "/models/box_large.glb",
  crates: "/models/crates_stacked.glb",
  boxstack: "/models/box_stacked.glb",
};
Object.values(PROP_URL).forEach((u) => useGLTF.preload(u));

const GRAFFITI = [
  "IT HEARS YOU",
  "DON'T RUN",
  "follow the buzz",
  "NO EXIT NO EXIT",
  "stay quiet",
  "M.E.G. was here",
  "|||| |||| ||",
  "the wall flickers",
];

function Prop({ url, x, z, rotY }: { url: string; x: number; z: number; rotY: number }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={[x, 0, z]} rotation={[0, rotY, 0]} scale={1.15} />;
}

function graffitiTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 256);
  g.font = "bold 52px 'Comic Sans MS', cursive, sans-serif";
  g.fillStyle = "rgba(60, 30, 20, 0.85)";
  g.textAlign = "center";
  g.save();
  g.translate(256, 140);
  g.rotate(-0.06);
  g.fillText(text, 0, 0, 460);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Graffiti({ text, x, z, rotY }: { text: string; x: number; z: number; rotY: number }) {
  const tex = useMemo(() => graffitiTexture(text), [text]);
  return (
    <mesh position={[x, 1.45, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[2.2, 1.1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

export function Props({ seed, level = 0 }: { seed: number; level?: number }) {
  const items = useMemo(() => {
    const maze = generateMaze(seed);
    // furniture layout comes from shared (same source as collision)
    const props = placeProps(seed, maze, level).map((p) => ({ url: PROP_URL[p.kind], ...p }));

    // graffiti: on ~10 random full-length walls, offset off the surface
    const rng = makeRng(seed ^ 0x6ea111); // graffiti roll — separate stream from furniture
    const tags: Array<{ text: string; x: number; z: number; rotY: number }> = [];
    const fullWalls =
      level >= 2 ? [] : maze.walls.filter((w) => Math.max(w.w, w.d) > CELL * 0.8);
    for (let k = 0; k < Math.min(10, fullWalls.length); k++) {
      const w = fullWalls[rng.int(0, fullWalls.length)]!;
      const horizontal = w.w > w.d; // wall runs along X → faces ±Z
      const side = rng.next() < 0.5 ? 1 : -1;
      tags.push({
        text: GRAFFITI[rng.int(0, GRAFFITI.length)]!,
        x: w.x + (horizontal ? 0 : side * (w.w / 2 + 0.02)),
        z: w.z + (horizontal ? side * (w.d / 2 + 0.02) : 0),
        rotY: horizontal ? (side === 1 ? 0 : Math.PI) : side === 1 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
    return { props, tags };
  }, [seed, level]);

  return (
    <group>
      {items.props.map((p, i) => (
        <Prop key={i} {...p} />
      ))}
      {items.tags.map((t, i) => (
        <Graffiti key={i} {...t} />
      ))}
    </group>
  );
}
