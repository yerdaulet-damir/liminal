// First-person controller. Captures input, moves with shared collision, sends transform at tick rate.
// Thin edge: local prediction of our own walk for feel; the room owns the roster + entity.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import {
  CROUCH_SPEED,
  EYE_HEIGHT,
  PLAYER_RADIUS,
  SPRINT_CD_MS,
  SPRINT_MS,
  SPRINT_SPEED,
  TICK_MS,
  WALK_SPEED,
  pushOutOfCircles,
  resolveMove,
} from "@liminal/shared";
import { setThinWallDistance } from "../audio/ambience.js";
import { levelWorld } from "../scene/levelWorld.js";
import { flashlightFor, resetFlashlight } from "./flashlight.js";
import { bindingFor, readSeatInput, TURN_RATE } from "./inputScheme.js";
import { micLoudness } from "../audio/mic.js";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

export function Player({
  seed,
  level = 0,
  seat = 0,
  sendMove,
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
  sendMove: (x: number, z: number, ry: number, lit?: boolean, mic?: number) => void;
  /** blocks movement (round over OR you are down) */
  frozen?: boolean;
  /** true only between rounds — triggers the snap back to spawn on restart */
  roundEnded?: boolean;
}) {
  const { camera } = useThree();
  const { maze, props } = useMemo(() => levelWorld(seed, level), [seed, level]);
  const binding = bindingFor(seat);
  const flashlight = flashlightFor(seat);
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef({ x: maze.start.x, z: maze.start.z });
  const yaw = useRef(0);
  const sendAcc = useRef(0);
  const sprint = useRef({ budgetMs: SPRINT_MS, cdMs: 0 });

  useEffect(() => {
    camera.position.set(maze.start.x, EYE_HEIGHT, maze.start.z);
    camera.lookAt(maze.start.x + 1, EYE_HEIGHT, maze.start.z + 1); // face into the maze, not a wall
    yaw.current = camera.rotation.y;
    resetFlashlight(seat); // fresh battery each level (component remounts per level)
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      keys.current[e.code] = true;
      if (e.code === binding.torch && level >= 1 && flashlight.batteryS > 0) {
        flashlight.on = !flashlight.on;
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

  // On restart (round ended → playing) snap back to the spawn, mirroring the server's reset.
  const wasEnded = useRef(false);
  useFrame((_, dt) => {
    if (roundEnded) wasEnded.current = true;
    if (frozen) return;
    if (wasEnded.current) {
      wasEnded.current = false;
      pos.current = { x: maze.start.x, z: maze.start.z };
      camera.position.set(maze.start.x, EYE_HEIGHT, maze.start.z);
    }
    const input = readSeatInput(seat, keys.current);
    // seats without a mouse turn the body with their own keys/stick; the mouse owns yaw otherwise
    if (binding.tank && input.turn !== 0) {
      yaw.current += input.turn * TURN_RATE * Math.min(dt, 0.05);
      camera.rotation.set(0, yaw.current, 0);
    }

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x); // cross(dir, up) — D strafes right

    const move = new THREE.Vector3()
      .addScaledVector(dir, input.fwd)
      .addScaledVector(right, input.strafe);
    if (move.lengthSq() > 0) move.normalize();

    // crouch = slow + silent to the monster; sprint = 3 s budget, 5 s cooldown
    const dtMs = dt * 1000;
    const sp = sprint.current;
    let speed = WALK_SPEED;
    if (input.crouch) speed = CROUCH_SPEED;
    else if (input.sprint && sp.cdMs <= 0 && sp.budgetMs > 0 && move.lengthSq() > 0) {
      speed = SPRINT_SPEED;
      sp.budgetMs -= dtMs;
      if (sp.budgetMs <= 0) sp.cdMs = SPRINT_CD_MS;
    }
    if (sp.cdMs > 0) {
      sp.cdMs -= dtMs;
      if (sp.cdMs <= 0) sp.budgetMs = SPRINT_MS;
    } else if (speed !== SPRINT_SPEED && sp.budgetMs < SPRINT_MS) {
      sp.budgetMs = Math.min(SPRINT_MS, sp.budgetMs + dtMs * 0.5); // slow refill when not drained
    }

    const step = speed * Math.min(dt, 0.05);
    const walls = resolveMove(
      maze,
      pos.current.x,
      pos.current.z,
      pos.current.x + move.x * step,
      pos.current.z + move.z * step,
      PLAYER_RADIUS,
    );
    const next = pushOutOfCircles(walls.x, walls.z, PLAYER_RADIUS, props);
    pos.current = next;
    setThinWallDistance(
      unlocked ? Math.hypot(next.x - maze.thinWall.x, next.z - maze.thinWall.z) : Infinity,
      seat,
    );
    camera.position.set(next.x, EYE_HEIGHT, next.z);

    // flashlight battery drains only while ON; dead battery snaps it off
    if (flashlight.on) {
      flashlight.batteryS = Math.max(0, flashlight.batteryS - dt);
      if (flashlight.batteryS === 0) flashlight.on = false;
    }

    sendAcc.current += dt;
    if (sendAcc.current >= TICK_MS / 1000) {
      sendAcc.current = 0;
      sendMove(next.x, next.z, Math.atan2(dir.x, dir.z), flashlight.on, micLoudness());
    }
  });

  return (
    <>
      {!binding.tank && <PointerLockControls />}
      <Beam seat={seat} />
    </>
  );
}

// The flashlight beam — follows the camera, visible only when ON.
function Beam({ seat }: { seat: number }) {
  const { camera } = useThree();
  const flashlight = flashlightFor(seat);
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  const dir = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!light.current || !target.current) return;
    light.current.visible = flashlight.on;
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
