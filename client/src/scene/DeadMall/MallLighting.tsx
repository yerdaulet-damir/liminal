import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";
import { CELL, MAZE_COLS, MAZE_ROWS, WALL_HEIGHT } from "@liminal/shared";

const WIDTH = MAZE_COLS * CELL;
const DEPTH = MAZE_ROWS * CELL;
const LIGHTS: Array<[number, number, number]> = [
  [WIDTH * 0.25, WALL_HEIGHT - 0.35, DEPTH * 0.25],
  [WIDTH * 0.5, WALL_HEIGHT - 0.35, DEPTH * 0.28],
  [WIDTH * 0.75, WALL_HEIGHT - 0.35, DEPTH * 0.25],
  [WIDTH * 0.22, WALL_HEIGHT - 0.35, DEPTH * 0.68],
  [WIDTH * 0.52, WALL_HEIGHT - 0.35, DEPTH * 0.72],
  [WIDTH * 0.78, WALL_HEIGHT - 0.35, DEPTH * 0.68],
];

export function MallLighting({ outage }: { outage: boolean }) {
  const lights = useRef<Array<PointLight | null>>([]);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    for (let index = 0; index < lights.current.length; index++) {
      const light = lights.current[index];
      if (!light) continue;
      const buzz = Math.sin(time * (4.7 + index * 0.19) + index * 9.1);
      light.intensity = outage ? 0 : index === 4 ? 0 : buzz < -0.94 ? 0.35 : 5.2;
    }
  });

  return (
    <>
      <hemisphereLight args={["#9ca5a0", "#363735", outage ? 0.08 : 0.32]} />
      <ambientLight intensity={outage ? 0.035 : 0.14} color="#afb4ad" />
      <fogExp2 attach="fog" args={["#343633", outage ? 0.075 : 0.035]} />
      <spotLight
        position={[WIDTH / 2, WALL_HEIGHT - 0.12, DEPTH / 2]}
        color="#b8c4ba"
        intensity={outage ? 0.2 : 19}
        distance={CELL * 5}
        angle={0.82}
        penumbra={0.8}
        decay={1.7}
      />
      {LIGHTS.map((position, index) => (
        <group key={index} position={position}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.25, 0.28]} />
            <meshStandardMaterial
              color="#b9b6a4"
              emissive="#cac8af"
              emissiveIntensity={outage || index === 4 ? 0.04 : 1.15}
            />
          </mesh>
          <pointLight
            ref={(light) => (lights.current[index] = light)}
            color="#d4d1b5"
            intensity={5.2}
            distance={CELL * 3.1}
            decay={1.9}
          />
        </group>
      ))}
    </>
  );
}
