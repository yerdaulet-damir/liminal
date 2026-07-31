// A grin in the dark with nothing around it. No model, no rig, no download: two eyes and a row
// of teeth, and the room does the rest.
//
// It is set dressing, not an entity — it never moves and the room tick never hears about it.
// What sells it is the fade: it resolves out of the dark as you approach, and is gone by the
// time you are close enough to be sure. You never get to confirm it was there.

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SmilerPlacement } from "@liminal/shared";

const TEETH = 9;
const toothGeometry = new THREE.BoxGeometry(1, 1, 0.04);
const eyeGeometry = new THREE.SphereGeometry(0.5, 10, 8);

/** Seen from this far; solid at this range; gone by the time you could touch it. */
const FAR = 17;
const NEAR = 6.5;
const VANISH = 3.4;

function visibility(distance: number): number {
  if (distance > FAR || distance < VANISH) return 0;
  if (distance > NEAR) return (FAR - distance) / (FAR - NEAR);
  return (distance - VANISH) / (NEAR - VANISH);
}

function Smiler({ place }: { place: SmilerPlacement }) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#f4f2e6",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  // teeth along an arc, corners of the mouth turned up further than a face turns up
  const teeth = useMemo(
    () =>
      Array.from({ length: TEETH }, (_, i) => {
        const t = (i / (TEETH - 1)) * 2 - 1; // -1..1 across the mouth
        return {
          position: [t * place.width, Math.abs(t) ** 2 * place.width * 0.42 - 0.18, 0] as const,
          scale: [place.width * 0.19, 0.13 - Math.abs(t) * 0.035, 1] as const,
          rotation: t * 0.55,
        };
      }),
    [place.width],
  );

  const { camera } = useThree();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    material.opacity = visibility(g.position.distanceTo(camera.position));
    g.visible = material.opacity > 0.01;
    if (g.visible) g.lookAt(camera.position); // it was always facing you
  });

  return (
    <group ref={group} position={[place.x, place.y, place.z]}>
      {teeth.map((tooth, i) => (
        <mesh
          key={i}
          geometry={toothGeometry}
          material={material}
          position={tooth.position as unknown as [number, number, number]}
          scale={tooth.scale as unknown as [number, number, number]}
          rotation={[0, 0, tooth.rotation]}
        />
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={eyeGeometry}
          material={material}
          position={[side * place.width * 0.42, 0.5, 0]}
          scale={[0.11, 0.055, 0.02]}
        />
      ))}
    </group>
  );
}

export function Smilers({ places }: { places: SmilerPlacement[] }) {
  return (
    <>
      {places.map((place, i) => (
        <Smiler key={i} place={place} />
      ))}
    </>
  );
}
