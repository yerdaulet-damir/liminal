import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

function useMallTexture(url: string, repeatX: number, repeatY: number): THREE.Texture {
  const source = useTexture(url);
  return useMemo(() => {
    const texture = source.clone();
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [source, repeatX, repeatY]);
}

export function useMallMaterials() {
  const shutter = useMallTexture("/textures/mall-shutter.webp", 1.7, 1.25);

  return { shutter };
}
