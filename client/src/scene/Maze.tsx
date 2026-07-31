// Renders the maze the procgen layer produced from the seed. Pure read — no game state here.
// Materials: real CC0 PBR color maps (ambientCG) — yellowed wallpaper, damp carpet, office tiles.

import { useMemo, useRef } from "react";
import { levelWorld } from "./levelWorld.js";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  CELL,
  MAZE_COLS,
  MAZE_ROWS,
  WALL_HEIGHT,
  generateMaze,
} from "@liminal/shared";

function useRepeatTexture(url: string, rx: number, ry: number): THREE.Texture {
  const tex = useTexture(url);
  return useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [tex, rx, ry]);
}

// per-level theme: 0 = yellow office lobby, 1 = concrete warehouse
const THEMES = [
  {
    floor: "/textures/carpet.jpg",
    floorTint: "#b3a25e",
    ceil: "/textures/ceiling.jpg",
    ceilTint: "#efe6c0",
    wall: "/textures/wallpaper.jpg",
    wallTint: "#d8c070",
  },
  {
    floor: "/textures/concrete.jpg",
    floorTint: "#6a6a66",
    ceil: "/textures/concrete.jpg",
    ceilTint: "#4a4a46",
    wall: "/textures/concrete.jpg",
    wallTint: "#8a8a84",
  },
  {
    floor: "/textures/poolfloor.jpg",
    floorTint: "#9fd8e8",
    ceil: "/textures/pooltile.jpg",
    ceilTint: "#f4fbff",
    wall: "/textures/pooltile.jpg",
    wallTint: "#eef6f8",
  },
];

export function Maze({
  seed,
  level = 0,
  unlocked = true,
}: {
  seed: number;
  level?: number;
  /** All keys found — only then does the thin wall start to flicker and let you through. */
  unlocked?: boolean;
}) {
  const maze = useMemo(() => levelWorld(seed, level).maze, [seed, level]);
  const worldW = MAZE_COLS * CELL;
  const worldD = MAZE_ROWS * CELL;
  const theme = THEMES[Math.min(level, THEMES.length - 1)]!;

  const floor = useRepeatTexture(theme.floor, worldW / 3, worldD / 3);
  const ceiling = useRepeatTexture(theme.ceil, worldW / 2.4, worldD / 2.4);
  const wallTex = useRepeatTexture(theme.wall, 1.6, 1.2);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[worldW / 2, 0, worldD / 2]} receiveShadow>
        <planeGeometry args={[worldW, worldD]} />
        <meshStandardMaterial map={floor} color={theme.floorTint} roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[worldW / 2, WALL_HEIGHT, worldD / 2]}>
        <planeGeometry args={[worldW, worldD]} />
        <meshStandardMaterial map={ceiling} color={theme.ceilTint} roughness={1} />
      </mesh>
      {maze.walls.map((w, i) => (
        <mesh key={i} position={[w.x, WALL_HEIGHT / 2, w.z]} castShadow receiveShadow>
          <boxGeometry args={[w.w, WALL_HEIGHT, w.d]} />
          <meshStandardMaterial map={wallTex} color={theme.wallTint} roughness={0.9} />
        </mesh>
      ))}
      {/* the noclip spot — looks like every other wall, but it flickers. that's the only tell. */}
      <ThinWall maze={maze} tex={wallTex} tint={theme.wallTint} unlocked={unlocked} />
      {/* the Poolrooms: lukewarm water everywhere, ankle deep */}
      {level >= 2 && <Water w={worldW} d={worldD} />}
    </group>
  );
}

function Water({ w, d }: { w: number; d: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current?.map) return;
    const t = clock.elapsedTime;
    mat.current.map.offset.set(Math.sin(t * 0.05) * 0.05, t * 0.008); // slow drift
  });
  const tex = useRepeatTexture("/textures/poolfloor.jpg", w / 4, d / 4);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0.35, d / 2]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        ref={mat}
        map={tex}
        color="#7fd4ee"
        transparent
        opacity={0.55}
        roughness={0.15}
        metalness={0.1}
      />
    </mesh>
  );
}

function ThinWall({
  maze,
  tex,
  tint,
  unlocked,
}: {
  maze: ReturnType<typeof generateMaze>;
  tex: THREE.Texture;
  tint: string;
  unlocked: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    if (!unlocked) {
      mat.current.opacity = 1; // still solid: nothing to see, nothing to hear
      return;
    }
    const t = clock.elapsedTime;
    const flicker = Math.sin(t * 13) * Math.sin(t * 7.3) > 0.82 ? 0.35 : 1;
    mat.current.opacity = flicker;
  });
  const w = maze.thinWall;
  return (
    <mesh position={[w.x, WALL_HEIGHT / 2, w.z]}>
      <boxGeometry args={[w.w, WALL_HEIGHT, w.d]} />
      <meshStandardMaterial ref={mat} map={tex} color={tint} roughness={0.9} transparent />
    </mesh>
  );
}
