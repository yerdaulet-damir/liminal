// The Backrooms is BRIGHT — sickly fluorescent yellow everywhere, dread from sameness not darkness.
// Emissive ceiling panels carry the look; a few point lights + hemisphere carry the illumination.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CELL, MAZE_COLS, MAZE_ROWS, WALL_HEIGHT } from "@liminal/shared";
import type { PointLight } from "three";
import { MallLighting } from "./DeadMall/MallLighting.js";

export function Lighting({ level = 0, outage = false }: { level?: number; outage?: boolean }) {
  const lights = useRef<Array<PointLight | null>>([]);
  const dark = level === 1; // the warehouse: sparse cold light, heavier gloom
  const pool = level === 2; // the Poolrooms alone are the bright reward beat

  // emissive light panels: every 2 cells (the look)
  const panels: Array<[number, number, number]> = [];
  for (let i = 0; i < MAZE_COLS; i += 2) {
    for (let j = 0; j < MAZE_ROWS; j += 2) {
      panels.push([i * CELL + CELL / 2, WALL_HEIGHT - 0.02, j * CELL + CELL / 2]);
    }
  }
  // real point lights: every 4 cells (the cost)
  const points: Array<[number, number, number]> = [];
  for (let i = 1; i < MAZE_COLS; i += 4) {
    for (let j = 1; j < MAZE_ROWS; j += 4) {
      points.push([i * CELL, WALL_HEIGHT - 0.4, j * CELL]);
    }
  }

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((l, i) => {
      if (!l) return;
      // mostly steady with an occasional buzz-drop — flicker is an event, not a strobe.
      // the warehouse flickers more: worse wiring down here.
      if (outage) {
        l.intensity = 0;
        return;
      }
      const n = Math.sin(t * (6 + (i % 5)) + i * 13.7);
      const cutoff = dark ? -0.75 : -0.93;
      l.intensity = n > cutoff ? (dark ? 6 : 10) : dark ? 0.6 : 3;
    });
  });

  if (level === 3) return <MallLighting outage={outage} />;

  if (pool) {
    // Sublimity: bright, soft, blue-white. No flicker, no fear — the reward beat.
    return (
      <>
        <hemisphereLight args={["#eaf6ff", "#7fb8cc", 1.0]} />
        <ambientLight intensity={0.55} color="#e8f4fa" />
        <fogExp2 attach="fog" args={["#cfe8f2", 0.02]} />
      </>
    );
  }

  return (
    <>
      <hemisphereLight
        args={dark ? ["#7a8288", "#2c2c28", outage ? 0.06 : 0.42] : ["#f2e6b0", "#8a7f4e", 0.75]}
      />
      <ambientLight
        intensity={dark ? (outage ? 0.04 : 0.18) : 0.35}
        color={dark ? "#aab4b8" : "#f5ecc0"}
      />
      <fogExp2 attach="fog" args={dark ? ["#0a0b0b", outage ? 0.09 : 0.05] : ["#cfc188", 0.028]} />
      {panels.map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 0.9]} />
          <meshStandardMaterial
            color={dark ? "#2e3234" : "#fffbe0"}
            emissive={dark ? "#b8ccd4" : "#fff8cf"}
            emissiveIntensity={outage && dark ? 0.02 : dark ? 0.9 : 2.2}
          />
        </mesh>
      ))}
      {points.map((p, i) => (
        <pointLight
          key={i}
          ref={(el) => (lights.current[i] = el)}
          position={p}
          color={dark ? "#cfe0e8" : "#fff2b8"}
          intensity={dark ? 6 : 10}
          distance={CELL * (dark ? 4 : 6)}
          decay={dark ? 1.8 : 1.4}
        />
      ))}
    </>
  );
}
