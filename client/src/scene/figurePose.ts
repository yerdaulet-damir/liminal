// Posing the residents. The figure packs ship a rigged skeleton and zero animation clips, so
// a "sitting" body has to be built by rotating named bones — which is free, and gives real
// sitting, kneeling and reaching instead of a standing model tipped over on its side.
//
// Bone names come from the Quaternius modular rig (Hips / UpperLeg.L / LowerArm.R / ...).
// Anything missing is skipped, so a pack with a different rig degrades to the root transform.

import * as THREE from "three";
import type { FigurePose } from "@liminal/shared";

export interface PoseSpec {
  /** Whole-body rotation in radians (x, z — y is the placement's own facing). */
  root: [number, number];
  /** Metres to lift or sink the body. */
  y: number;
  /** Euler deltas added to each bone's rest pose, in bone-local space. */
  bones?: Record<string, [number, number, number]>;
}

const HALF = Math.PI / 2;

// Which local axis actually swings a bone is a property of the export, not a guess. Measured on
// this rig by rotating one bone at a time and reading the world position of the bone below it:
//   UpperLeg  x−  → knee forward           (thigh out in front, for sitting)
//   LowerLeg  x+  → heel back and up       (shin folded under, for kneeling)
//   UpperArm  z∓  → hand forward, mirrored (the only symmetric arm axis; x twists asymmetrically)
//   Torso     x+  → whole upper body folds forward
//   Neck/Head z   → head tips sideways
const SIT_LEGS: Record<string, [number, number, number]> = {
  "UpperLeg.L": [-HALF, 0, 0],
  "UpperLeg.R": [-HALF, 0, 0],
  "LowerLeg.L": [0.25, 0, 0],
  "LowerLeg.R": [0.25, 0, 0],
};

const KNEEL_LEGS: Record<string, [number, number, number]> = {
  "UpperLeg.L": [-0.25, 0, 0],
  "UpperLeg.R": [-0.25, 0, 0],
  "LowerLeg.L": [2.5, 0, 0],
  "LowerLeg.R": [2.5, 0, 0],
};

/** Both hands out in front, mirrored. `amount` is how far. */
const armsForward = (amount: number): Record<string, [number, number, number]> => ({
  "UpperArm.L": [0, 0, -amount],
  "UpperArm.R": [0, 0, amount],
});

export const FIGURE_POSES: Record<FigurePose, PoseSpec> = {
  // whole-body wrongness — the room did this to them
  "facing-wall": { root: [0, 0], y: 0 },
  "upside-down": { root: [Math.PI, 0], y: 1.85 },
  collapsed: { root: [-HALF, 0.35], y: 0.12 },
  sunken: { root: [0, 0], y: -0.85 },
  leaning: { root: [0, 0.42], y: 0.05 },

  // posed on the skeleton — these read as choices, which is worse
  // hips land at 0.15 m sitting, knees at 0.12 m kneeling: measured, not eyeballed
  standing: { root: [0, 0], y: 0, bones: armsForward(0.2) },
  sitting: { root: [0, 0], y: -0.72, bones: { ...SIT_LEGS, ...armsForward(0.15) } },
  kneeling: { root: [0, 0], y: -0.42, bones: KNEEL_LEGS },
  praying: {
    root: [0, 0],
    y: -0.42,
    bones: { ...KNEEL_LEGS, Torso: [1.35, 0, 0], Chest: [0.5, 0, 0] },
  },
  reaching: { root: [0, 0], y: 0, bones: armsForward(1.2) },
  "head-tilt": { root: [0, 0], y: 0, bones: { Neck: [0, 0, 1.0], Head: [0, 0, 0.5] } },
};

// glTF loaders strip characters that are reserved in animation paths, so the rig's `UpperLeg.L`
// arrives as `UpperLegL`. Match on letters only and both spellings hit the same bone.
const boneKey = (name: string): string => name.replace(/[^a-z]/gi, "").toLowerCase();

/** Rotate the named bones of an already-cloned figure. Mutates in place; call once, not per frame. */
export function applyPose(root: THREE.Object3D, pose: FigurePose): PoseSpec {
  const spec = FIGURE_POSES[pose];
  if (!spec.bones) return spec;
  const deltas = new Map(Object.entries(spec.bones).map(([name, d]) => [boneKey(name), d]));
  root.traverse((object) => {
    const delta = deltas.get(boneKey(object.name));
    if (!delta) return;
    object.rotation.x += delta[0];
    object.rotation.y += delta[1];
    object.rotation.z += delta[2];
  });
  return spec;
}
