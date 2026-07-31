// The bug this guards: glTF loaders strip the dot out of `UpperLeg.L`, so a pose table written
// against the rig's own bone names matched nothing and every "sitting" figure stood up straight.
// Silent, because a pose that does nothing still renders a person.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FIGURE_POSES, applyPose } from "./figurePose.js";

/** A stand-in skeleton using the loader's sanitized spelling. */
function rig(): THREE.Object3D {
  const root = new THREE.Object3D();
  for (const name of ["Hips", "Torso", "Chest", "Neck", "Head", "UpperLegL", "LowerLegL", "UpperArmL", "UpperArmR"]) {
    const bone = new THREE.Object3D();
    bone.name = name;
    root.add(bone);
  }
  return root;
}

const boneNamed = (root: THREE.Object3D, name: string) =>
  root.children.find((child) => child.name === name)!;

describe("figure poses", () => {
  it("matches bones whose dots the loader stripped", () => {
    const root = rig();
    applyPose(root, "sitting");
    expect(boneNamed(root, "UpperLegL").rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(boneNamed(root, "LowerLegL").rotation.x).toBeCloseTo(0.25);
  });

  it("reaches with both arms mirrored, or the figure reaches sideways", () => {
    const root = rig();
    applyPose(root, "reaching");
    expect(boneNamed(root, "UpperArmL").rotation.z).toBeCloseTo(
      -boneNamed(root, "UpperArmR").rotation.z,
    );
    expect(boneNamed(root, "UpperArmL").rotation.z).not.toBe(0);
  });

  it("gives every posed pose at least one bone that actually moves", () => {
    for (const [pose, spec] of Object.entries(FIGURE_POSES)) {
      if (!spec.bones) continue;
      const root = rig();
      applyPose(root, pose as keyof typeof FIGURE_POSES);
      const moved = root.children.some(
        (b) => b.rotation.x !== 0 || b.rotation.y !== 0 || b.rotation.z !== 0,
      );
      expect(moved, `${pose} moved no bone on this rig`).toBe(true);
    }
  });
});
