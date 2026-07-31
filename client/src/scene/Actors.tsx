// Renders the other player(s) and the server-authoritative entity, smoothing toward the latest
// received snapshot. Reads stateRef directly in useFrame (no re-render per tick); the id list
// drives mesh creation declaratively.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { PATROL_SPEED } from "@liminal/shared";
import type { Room } from "../net/useRoom.js";
import { setMonsterDistance, startHeartbeat, stopHeartbeat } from "../audio/heartbeat.js";
import { setPoolMode, startAmbience, stopAmbience } from "../audio/ambience.js";
import {
  playRoar,
  playScream,
  setBreathDistance,
  startMonsterAudio,
  stopMonsterAudio,
} from "../audio/monster.js";

const CHARACTERS = ["/models/player1.glb", "/models/player2.glb"];
CHARACTERS.forEach((u) => useGLTF.preload(u));
useGLTF.preload("/models/monster.glb");

// KayKit Adventurers (CC0): rigged + animated. Pick clips by name at runtime.
function RemotePlayer({ id, room, slot }: { id: string; room: Room; slot: number }) {
  const ref = useRef<THREE.Group>(null);
  const url = CHARACTERS[slot % CHARACTERS.length]!;
  const { scene, animations } = useGLTF(url);
  const { cloned, scale } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    // packs export at arbitrary units — normalize every character to human height
    const box = new THREE.Box3().setFromObject(c);
    const h = box.max.y - box.min.y;
    return { cloned: c, scale: h > 0 ? 1.8 / h : 1 };
  }, [scene]);
  const { actions, names } = useAnimations(animations, ref);
  const moving = useRef(false);
  const currentClip = useRef<string | null>(null);

  const clipFor = (want: RegExp, fallback: RegExp): string | null =>
    names.find((n) => want.test(n)) ?? names.find((n) => fallback.test(n)) ?? names[0] ?? null;

  useFrame(() => {
    const p = room.stateRef.current?.players.find((x) => x.id === id);
    if (!p || !ref.current) return;
    const target = new THREE.Vector3(p.x, 0, p.z);
    const wasFar = ref.current.position.distanceTo(target);
    ref.current.position.lerp(target, 0.25);
    ref.current.rotation.y = p.ry + Math.PI; // KayKit models face +Z; ry is view direction
    ref.current.rotation.x = p.down ? -Math.PI / 2 + 0.12 : 0; // downed → lying on the carpet

    moving.current = wasFar > 0.12 && !p.down;
    const wanted = p.down
      ? null
      : moving.current
        ? clipFor(/walk/i, /run/i)
        : clipFor(/idle/i, /pose/i);
    if (wanted !== currentClip.current) {
      if (currentClip.current) actions[currentClip.current]?.fadeOut(0.2);
      if (wanted) actions[wanted]?.reset().fadeIn(0.2).play();
      currentClip.current = wanted;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

// The Creep (CC0, Quaternius Ultimate Monsters): rigged + 17 clips, darkened to a near-black
// hide with two glowing eyes. Animation follows the director's mood; audio follows distance.
function Entity({ room, seat }: { room: Room; seat: number }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { scene, animations } = useGLTF("/models/monster.glb");
  const { cloned, scale } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        // it eats the light: near-black hide with a wet sheen
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        m.color.set("#161210");
        m.roughness = 0.5;
        mesh.material = m;
      }
    });
    const box = new THREE.Box3().setFromObject(c);
    const h = box.max.y - box.min.y;
    return { cloned: c, scale: h > 0 ? 2.3 / h : 1 };
  }, [scene]);
  const { actions, names } = useAnimations(animations, ref);
  const currentClip = useRef<string | null>(null);
  const lastMood = useRef<string>("calm");
  const wasSelfDown = useRef(false);
  // locomotion: rendered-body velocity drives gait + heading (kills foot-slide and the
  // "glides sideways while staring at you" look). Reused vectors — no alloc in useFrame.
  const prevPos = useRef(new THREE.Vector3());
  const snapTarget = useMemo(() => new THREE.Vector3(), []);
  const speed = useRef(0);
  const yaw = useRef(0);

  // On a shared laptop both seats render the entity, but there is one set of speakers:
  // seat 0 owns the audio contexts. Distances still come from both (closest wins).
  useEffect(() => {
    if (seat !== 0) return undefined;
    const start = () => {
      startHeartbeat();
      void startAmbience();
      void startMonsterAudio();
    };
    window.addEventListener("pointerdown", start); // autoplay policy: needs a gesture
    return () => {
      window.removeEventListener("pointerdown", start);
      stopHeartbeat();
      stopAmbience();
      stopMonsterAudio();
    };
  }, [seat]);

  useFrame((_, dt) => {
    const s = room.stateRef.current;
    const e = s?.entity;
    if (!e || !ref.current) return;
    // the Poolrooms is a breather — nothing lives there
    ref.current.visible = room.level < 2;
    setPoolMode(room.level >= 2);
    if (!ref.current.visible) {
      setBreathDistance(Infinity, seat);
      setMonsterDistance(Infinity, seat);
      return;
    }
    const dtS = Math.min(dt, 0.1); // tab-switch dt spike would teleport the heading
    snapTarget.set(e.x, 0, e.z);
    ref.current.position.lerp(snapTarget, 0.2);
    const stepDist = ref.current.position.distanceTo(prevPos.current);
    speed.current += (stepDist / Math.max(dtS, 1e-4) - speed.current) * 0.15; // low-pass
    const moving = speed.current > 0.25;

    // face where it walks; standing still it turns to face you — slowly. That IS the stare.
    const targetYaw = moving && stepDist > 1e-4
      ? Math.atan2(ref.current.position.x - prevPos.current.x, ref.current.position.z - prevPos.current.z)
      : Math.atan2(camera.position.x - e.x, camera.position.z - e.z);
    const turnRate = e.mood === "hunt" ? 6 : moving ? 3.5 : 1.2; // rad/s
    const arc = shortestAngle(yaw.current, targetYaw);
    yaw.current += THREE.MathUtils.clamp(arc, -turnRate * dtS, turnRate * dtS);
    ref.current.rotation.y = yaw.current;
    prevPos.current.copy(ref.current.position);

    const dist = Math.hypot(camera.position.x - e.x, camera.position.z - e.z);
    setMonsterDistance(dist, seat);
    setBreathDistance(dist, seat);

    // roar the moment it starts hunting; scream the moment it takes YOU down
    if (e.mood !== lastMood.current) {
      if (e.mood === "hunt" && seat === 0) playRoar(); // one roar per room, not per viewport
      lastMood.current = e.mood;
    }
    const selfDown = s.players.some((p) => p.id === room.welcome?.selfId && p.down);
    if (selfDown && !wasSelfDown.current) playScream();
    wasSelfDown.current = selfDown;

    // movement → animation (mood only flavors the gait). Standing = idle, ALWAYS —
    // a walk clip on a stationary body is the treadmill; a moving body on idle is the glide.
    const wanted = moving
      ? e.mood === "hunt"
        ? pick(names, /walk2/i, /walk/i)
        : pick(names, /walk1/i, /walk/i)
      : pick(names, /sniff/i, /idle/i);
    if (wanted !== currentClip.current) {
      if (currentClip.current) actions[currentClip.current]?.fadeOut(0.25);
      if (wanted) actions[wanted]?.reset().fadeIn(0.25).play();
      currentClip.current = wanted;
    }
    // stride matches ground speed — feet plant instead of skating
    if (moving && currentClip.current) {
      const a = actions[currentClip.current];
      if (a) a.timeScale = THREE.MathUtils.clamp(speed.current / PATROL_SPEED, 0.6, 2.4);
    }

    // dev: ?watch keeps the camera locked on the entity (debugging + capturing clips)
    if (location.search.includes("watch")) camera.lookAt(e.x, 1.6, e.z);
  });

  // no bolted-on glowing eyes: they floated above the animated head (the rig moves, the
  // spheres didn't). The near-black hide against lit walls carries the silhouette alone.
  return (
    <group ref={ref}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

const pick = (names: string[], want: RegExp, fallback: RegExp): string | null =>
  names.find((n) => want.test(n)) ?? names.find((n) => fallback.test(n)) ?? names[0] ?? null;

/** Signed shortest arc from a to b, in (-π, π]. */
const shortestAngle = (a: number, b: number): number =>
  THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;

export function Actors({ room, seat = 0 }: { room: Room; seat?: number }) {
  const others = room.ids.filter((id) => id !== room.welcome?.selfId);
  return (
    <>
      {others.map((id, i) => (
        <RemotePlayer key={id} id={id} room={room} slot={i} />
      ))}
      <Entity room={room} seat={seat} />
    </>
  );
}
