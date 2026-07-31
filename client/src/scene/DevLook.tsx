// Dev-only: `?look=x,z` aims the camera at a world point every frame. Pointer lock does not
// work in headless browsers, so without this there is no way to verify how anything LOOKS.
// Renders nothing and does nothing unless the flag is present.

import { useFrame, useThree } from "@react-three/fiber";
import { EYE_HEIGHT } from "@liminal/shared";

export function DevLook() {
  const { camera } = useThree();
  const raw = new URLSearchParams(location.search).get("look");
  const target = raw?.split(",").map(Number);
  const active = !!target && target.length === 2 && target.every(Number.isFinite);

  useFrame(() => {
    if (!active) return;
    camera.lookAt(target![0]!, EYE_HEIGHT - 0.6, target![1]!);
  });

  return null;
}
