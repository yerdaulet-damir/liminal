// Renders the other player(s) and the server-authoritative entity, smoothing toward the latest
// received snapshot. Reads stateRef directly in useFrame (no re-render per tick); the id list
// drives mesh creation declaratively.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
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
function Entity({ room }: { room: Room }) {
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

  useEffect(() => {
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
  }, []);

  useFrame(() => {
    const s = room.stateRef.current;
    const e = s?.entity;
    if (!e || !ref.current) return;
    // the Poolrooms is a breather — nothing lives there
    ref.current.visible = room.level < 2;
    setPoolMode(room.level >= 2);
    if (!ref.current.visible) {
      setBreathDistance(Infinity);
      setMonsterDistance(Infinity);
      return;
    }
    ref.current.position.lerp(new THREE.Vector3(e.x, 0, e.z), 0.2);
    ref.current.lookAt(camera.position.x, 0, camera.position.z);
    const dist = Math.hypot(camera.position.x - e.x, camera.position.z - e.z);
    setMonsterDistance(dist);
    setBreathDistance(dist);

    // roar the moment it starts hunting; scream the moment it takes YOU down
    if (e.mood !== lastMood.current) {
      if (e.mood === "hunt") playRoar();
      lastMood.current = e.mood;
    }
    const selfDown = s.players.some((p) => p.id === room.welcome?.selfId && p.down);
    if (selfDown && !wasSelfDown.current) playScream();
    wasSelfDown.current = selfDown;

    // mood → animation
    const wanted =
      e.mood === "hunt"
        ? pick(names, /walk2/i, /walk/i)
        : e.mood === "stalk"
          ? pick(names, /walk1/i, /walk/i)
          : pick(names, /sniff/i, /idle/i);
    if (wanted !== currentClip.current) {
      if (currentClip.current) actions[currentClip.current]?.fadeOut(0.25);
      if (wanted) {
        const a = actions[wanted];
        a?.reset().fadeIn(0.25).play();
        if (a && e.mood === "hunt") a.timeScale = 1.6; // it hurries when it hunts
      }
      currentClip.current = wanted;
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

export function Actors({ room }: { room: Room }) {
  const others = room.ids.filter((id) => id !== room.welcome?.selfId);
  return (
    <>
      {others.map((id, i) => (
        <RemotePlayer key={id} id={id} room={room} slot={i} />
      ))}
      <Entity room={room} />
    </>
  );
}
