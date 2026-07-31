import { CELL, MAZE_COLS, MAZE_ROWS, WALL_HEIGHT } from "@liminal/shared";

const centerX = (MAZE_COLS * CELL) / 2;
const centerZ = (MAZE_ROWS * CELL) / 2;

export function MallAtrium() {
  return (
    <group>
      <mesh position={[centerX, WALL_HEIGHT - 0.045, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CELL * 3.4, CELL * 2.4]} />
        <meshPhysicalMaterial
          color="#aebfc0"
          emissive="#aab6ad"
          emissiveIntensity={0.48}
          transmission={0.25}
          transparent
          opacity={0.68}
          roughness={0.38}
        />
      </mesh>
      {[-1.2, 0, 1.2].map((offset) => (
        <mesh key={offset} position={[centerX + offset * CELL, WALL_HEIGHT - 0.08, centerZ]}>
          <boxGeometry args={[0.08, 0.12, CELL * 2.45]} />
          <meshStandardMaterial color="#484b49" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[centerX, 0.32, centerZ]}>
        <cylinderGeometry args={[1.75, 1.95, 0.64, 24]} />
        <meshStandardMaterial color="#857e70" roughness={0.92} />
      </mesh>
      <mesh position={[centerX, 0.69, centerZ]}>
        <cylinderGeometry args={[1.5, 1.62, 0.18, 24]} />
        <meshStandardMaterial color="#383b33" roughness={1} />
      </mesh>
      {[-0.72, 0, 0.72].map((offset) => (
        <mesh key={offset} position={[centerX + offset, 1.15 + Math.abs(offset) * 0.3, centerZ]}>
          <coneGeometry args={[0.42, 1.25, 7]} />
          <meshStandardMaterial color="#434f3c" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
