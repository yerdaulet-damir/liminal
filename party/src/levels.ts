// What each level IS. One table — a new level is a new row, not a new branch in the tick.

import type { MonsterRule } from "@liminal/shared";

export interface LevelDef {
  name: string;
  rule: MonsterRule;
  /** No entity, no outages — the breather beat (canon Level 37). */
  breather: boolean;
  /** Power outages: the dark belongs to it. */
  outages: boolean;
}

export const LEVELS: readonly LevelDef[] = [
  { name: "the lobby", rule: "listener", breather: false, outages: false },
  { name: "the warehouse", rule: "light-averse", breather: false, outages: true },
  { name: "the poolrooms", rule: "listener", breather: true, outages: false },
];

export const LAST_LEVEL = LEVELS.length - 1;

export const levelDef = (level: number): LevelDef =>
  LEVELS[Math.min(level, LAST_LEVEL)]!;
