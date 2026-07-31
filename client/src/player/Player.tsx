// First-person controller. Captures input, moves with shared collision, sends transform at tick rate.
// Thin edge: local prediction of our own walk for feel; the room owns the roster + entity.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import {
  EYE_HEIGHT,
  PLAYER_RADIUS,
  SPRINT_MS,
  TICK_MS,
  pushOutOfCircles,
  resolveMove,
  type Maze,
  type MovementMode,
  type PropPlacement,
} from "@liminal/shared";
import { setThinWallDistance } from "../audio/ambience.js";
import { micLoudness } from "../audio/mic.js";
import { levelWorld } from "../scene/levelWorld.js";
import { flashlightIntentFor, resetFlashlightIntent } from "./flashlight.js";
import { bindingFor, readSeatInput, TURN_RATE } from "./inputScheme.js";
import { speedForMovementMode, tickMovementMode } from "./movementMode.js";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

function setMovementVectors(
  camera: THREE.Camera,
  fwd: number,
  strafe: number,
  dir: THREE.Vector3,
  right: THREE.Vector3,
  move: THREE.Vector3,
): boolean {
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  right.set(-dir.z, 0, dir.x);
  move.set(0, 0, 0).addScaledVector(dir, fwd).addScaledVector(right, strafe);
  if (move.lengthSq() > 0) move.normalize();
  return move.lengthSq() > 0;
}

function resolvePlayerStep(
  maze: Maze,
  props: readonly PropPlacement[],
  pos: { x: number; z: number },
  move: THREE.Vector3,
  speed: number,
  dt: number,
): { x: number; z: number } {
  const step = speed * Math.min(dt, 0.05);
  const walls = resolveMove(
    maze,
    pos.x,
    pos.z,
    pos.x + move.x * step,
    pos.z + move.z * step,
    PLAYER_RADIUS,
  );
  return pushOutOfCircles(walls.x, walls.z, PLAYER_RADIUS, props);
}

export function Player({
  seed,
  level = 0,
  seat = 0,
  sendMove,
  readAuthoritativeLit,
  frozen = false,
  roundEnded = false,
  unlocked = true,
}: {
  seed: number;
  level?: number;
  /** which local player this is on a shared laptop: 0 = mouse+WASD, 1 = arrows/gamepad */
  seat?: number;
  /** the wall only hums once the keys are found */
  unlocked?: boolean;
  sendMove: (
    x: number,
    z: number,
    ry: number,
    lit?: boolean,
    mic?: number,
    mode?: MovementMode,
  ) => void;
  /** reads the latest server snapshot for this player; never predicted locally */
  readAuthoritativeLit: () => boolean;
  /** blocks movement (round over OR you are down) */
  frozen?: boolean;
  /** true only between rounds — triggers the snap back to spawn on restart */
  roundEnded?: boolean;
}) {
  const { camera } = useThree();
  const { maze, props } = useMemo(() => levelWorld(seed, level), [seed, level]);
  const binding = bindingFor(seat);
  const flashlight = flashlightIntentFor(seat);
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef({ x: maze.start.x, z: maze.start.z });
  const yaw = useRef(0);
  const sendAcc = useRef(0);
  const sprint = useRef({ budgetMs: SPRINT_MS, cdMs: 0 });
  const movementMode = useRef<MovementMode>("walk");
  const dir = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(maze.start.x, EYE_HEIGHT, maze.start.z);
    camera.lookAt(maze.start.x + 1, EYE_HEIGHT, maze.start.z + 1); // face into the maze, not a wall
    yaw.current = camera.rotation.y;
    resetFlashlightIntent(seat);
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      keys.current[e.code] = true;
      if (e.code === binding.torch && level >= 1) {
        flashlight.requested = !flashlight.requested;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      keys.current[e.code] = false;
    };
    const focus = (e: FocusEvent) => {
      if (isEditableTarget(e.target)) keys.current = {};
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("focusin", focus);
    };
  }, [camera, maze, level, seat, binding, flashlight]);

  const advanceMovement = (dt: number): void => {
    const input = readSeatInput(seat, keys.current);
    // seats without a mouse turn the body with their own keys/stick; the mouse owns yaw otherwise
    if (binding.tank && input.turn !== 0) {
      yaw.current += input.turn * TURN_RATE * Math.min(dt, 0.05);
      camera.rotation.set(0, yaw.current, 0);
    }

    const dtMs = dt * 1000;
    const moving = setMovementVectors(
      camera,
      input.fwd,
      input.strafe,
      dir.current,
      right.current,
      move.current,
    );
    movementMode.current = tickMovementMode(
      input.crouch,
      input.sprint,
      moving,
      dtMs,
      sprint.current,
    );
    const next = resolvePlayerStep(
      maze,
      props,
      pos.current,
      move.current,
      speedForMovementMode(movementMode.current),
      dt,
    );
    pos.current = next;
    setThinWallDistance(
      unlocked ? Math.hypot(next.x - maze.thinWall.x, next.z - maze.thinWall.z) : Infinity,
      seat,
    );
    camera.position.set(next.x, EYE_HEIGHT, next.z);
  };

  // On restart (round ended → playing) snap back to the spawn, mirroring the server's reset.
  const wasEnded = useRef(false);
  useFrame((_, dt) => {
    if (roundEnded) wasEnded.current = true;
    if (frozen) return;
    if (wasEnded.current) {
      wasEnded.current = false;
      pos.current.x = maze.start.x;
      pos.current.z = maze.start.z;
      camera.position.set(maze.start.x, EYE_HEIGHT, maze.start.z);
    }
    advanceMovement(dt);
    sendAcc.current += dt;
    if (sendAcc.current >= TICK_MS / 1000) {
      sendAcc.current = 0;
      sendMove(
        pos.current.x,
        pos.current.z,
        Math.atan2(dir.current.x, dir.current.z),
        flashlight.requested,
        micLoudness(),
        movementMode.current,
      );
    }
  });

  return (
    <>
      {!binding.tank && <PointerLockControls />}
      <Beam readAuthoritativeLit={readAuthoritativeLit} />
    </>
  );
}

// The flashlight beam — follows the camera, visible only when ON.
function Beam({ readAuthoritativeLit }: { readAuthoritativeLit: () => boolean }) {
  const { camera } = useThree();
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  const dir = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!light.current || !target.current) return;
    light.current.visible = readAuthoritativeLit();
    light.current.position.copy(camera.position);
    camera.getWorldDirection(dir.current);
    target.current.position.copy(camera.position).addScaledVector(dir.current, 6);
    light.current.target = target.current;
  });
  return (
    <>
      <spotLight
        ref={light}
        visible={false}
        color="#f4f0d8"
        intensity={40}
        angle={0.45}
        penumbra={0.6}
        distance={16}
        decay={1.6}
      />
      <object3D ref={target} />
    </>
  );
}
