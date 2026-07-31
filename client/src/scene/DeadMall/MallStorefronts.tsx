import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL, WALL_HEIGHT, type Maze } from "@liminal/shared";

interface Front {
  x: number;
  z: number;
  rotY: number;
  width: number;
  shuttered: boolean;
}

function buildFronts(maze: Maze): Front[] {
  const cells = maze.zones?.find((zone) => zone.kind === "storefront-loop")?.cells ?? [];
  const centerI = (maze.cols - 1) / 2;
  const centerJ = (maze.rows - 1) / 2;
  return cells.map((cell, index) => {
    const i = cell % maze.cols;
    const j = Math.floor(cell / maze.cols);
    const horizontal = Math.abs(i - centerI) > Math.abs(j - centerJ);
    const side = horizontal ? Math.sign(i - centerI) : Math.sign(j - centerJ);
    const open = maze.open[cell]!;
    const outwardOpen = horizontal
      ? side > 0 ? open.e : open.w
      : side > 0 ? open.s : open.n;
    return {
      x: (i + 0.5) * CELL + (horizontal ? side * CELL * 0.42 : 0),
      z: (j + 0.5) * CELL + (horizontal ? 0 : side * CELL * 0.42),
      rotY: horizontal ? Math.PI / 2 : 0,
      width: CELL * 0.72,
      // Never paint a closed shutter across a passage carved by the authoritative layout.
      shuttered: !outwardOpen && index % 4 !== 1,
    };
  });
}

function StoreSign({ front, index }: { front: Front; index: number }) {
  const colors = ["#7d302d", "#265a5f", "#8a6c2f", "#504266"];
  return (
    <mesh position={[front.x, 2.55, front.z]} rotation={[0, front.rotY, 0]}>
      <boxGeometry args={[Math.min(front.width, 2.8), 0.36, 0.12]} />
      <meshStandardMaterial
        color={colors[index % colors.length]}
        emissive={colors[index % colors.length]}
        emissiveIntensity={0.12}
        roughness={0.75}
      />
    </mesh>
  );
}

export function MallStorefronts({ maze, shutterMap }: { maze: Maze; shutterMap: THREE.Texture }) {
  const fronts = useMemo(() => buildFronts(maze), [maze]);
  const { shuttered, open } = useMemo(
    () => ({
      shuttered: fronts.filter((front) => front.shuttered),
      open: fronts.filter((front) => !front.shuttered),
    }),
    [fronts],
  );
  const shutterRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    shuttered.forEach((front, index) => {
      dummy.position.set(front.x, WALL_HEIGHT * 0.47, front.z);
      dummy.rotation.set(0, front.rotY, 0);
      dummy.scale.set(front.width, WALL_HEIGHT * 0.68, 1);
      dummy.updateMatrix();
      shutterRef.current?.setMatrixAt(index, dummy.matrix);
    });
    open.forEach((front, index) => {
      dummy.position.set(front.x, WALL_HEIGHT * 0.46, front.z);
      dummy.rotation.set(0, front.rotY, 0);
      dummy.scale.set(front.width, WALL_HEIGHT * 0.66, 1);
      dummy.updateMatrix();
      glassRef.current?.setMatrixAt(index, dummy.matrix);
    });
    if (shutterRef.current) shutterRef.current.instanceMatrix.needsUpdate = true;
    if (glassRef.current) glassRef.current.instanceMatrix.needsUpdate = true;
  }, [open, shuttered]);

  return (
    <group>
      <instancedMesh ref={shutterRef} args={[undefined, undefined, shuttered.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={shutterMap} color="#77736d" metalness={0.62} roughness={0.58} />
      </instancedMesh>
      <instancedMesh ref={glassRef} args={[undefined, undefined, open.length]}>
        <planeGeometry args={[1, 1]} />
        <meshPhysicalMaterial color="#7d9694" transparent opacity={0.28} roughness={0.18} />
      </instancedMesh>
      {fronts.map((front, index) => (
        <StoreSign key={`${front.x}:${front.z}`} front={front} index={index} />
      ))}
    </group>
  );
}
