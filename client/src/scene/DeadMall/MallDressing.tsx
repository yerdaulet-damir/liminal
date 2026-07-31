import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL, type Maze } from "@liminal/shared";

function FoodCourt({ cells, cols }: { cells: number[]; cols: number }) {
  const tables = useRef<THREE.InstancedMesh>(null);
  const chairs = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(
    () =>
      cells
        .filter((cell) => cell !== 0)
        .slice(0, 6)
        .map((cell) => ({
          x: (cell % cols) * CELL + CELL / 2,
          z: Math.floor(cell / cols) * CELL + CELL / 2,
        })),
    [cells, cols],
  );
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    let chairIndex = 0;
    points.forEach(({ x, z }, index) => {
      dummy.position.set(x, 0.68, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tables.current?.setMatrixAt(index, dummy.matrix);
      const offsets: Array<[number, number]> = [
        [-0.78, 0],
        [0.78, 0],
        [0, -0.78],
        [0, 0.78],
      ];
      for (const [dx, dz] of offsets) {
        dummy.position.set(x + dx, 0.42, z + dz);
        dummy.rotation.y = dx === 0 ? 0 : Math.PI / 2;
        dummy.updateMatrix();
        chairs.current?.setMatrixAt(chairIndex++, dummy.matrix);
      }
    });
    if (tables.current) tables.current.instanceMatrix.needsUpdate = true;
    if (chairs.current) chairs.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <group>
      <instancedMesh ref={tables} args={[undefined, undefined, 6]}>
        <cylinderGeometry args={[0.72, 0.72, 0.08, 16]} />
        <meshStandardMaterial color="#d0c5ad" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={chairs} args={[undefined, undefined, 24]}>
        <boxGeometry args={[0.48, 0.82, 0.45]} />
        <meshStandardMaterial color="#7d3129" roughness={0.8} />
      </instancedMesh>
      <mesh position={[CELL * 3, 2.35, CELL * 0.65]}>
        <boxGeometry args={[5.7, 0.55, 0.18]} />
        <meshStandardMaterial color="#86633a" emissive="#684728" emissiveIntensity={0.22} />
      </mesh>
    </group>
  );
}

function ServiceWing({ cells, cols }: { cells: number[]; cols: number }) {
  const doors = cells.filter((_, index) => index % 6 === 0).slice(0, 5);
  return (
    <group>
      {doors.map((cell, index) => (
        <group
          key={cell}
          position={[(cell % cols) * CELL + CELL / 2, 0, Math.floor(cell / cols) * CELL]}
        >
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[1.35, 2.3, 0.16]} />
            <meshStandardMaterial color="#5c625e" metalness={0.55} roughness={0.62} />
          </mesh>
          <mesh position={[0.45, 1.2, -0.1]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#b34336" emissive="#8c211b" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[CELL * 10.5, 2.75, CELL * 6.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, CELL * 7.5, 10]} />
        <meshStandardMaterial color="#725c44" metalness={0.5} roughness={0.62} />
      </mesh>
    </group>
  );
}

export function MallDressing({ maze }: { maze: Maze }) {
  const foodCells = maze.zones?.find((zone) => zone.kind === "food-court")?.cells ?? [];
  const serviceCells = maze.zones?.find((zone) => zone.kind === "service-wing")?.cells ?? [];
  return (
    <>
      <FoodCourt cells={foodCells} cols={maze.cols} />
      <ServiceWing cells={serviceCells} cols={maze.cols} />
    </>
  );
}
