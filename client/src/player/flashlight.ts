// Tiny module store for the flashlight so the HUD (outside the Canvas) can read battery
// without prop-drilling through the scene graph. One entry per local seat — on a shared
// laptop each player carries their own torch and their own battery.

import { FLASHLIGHT_S } from "@liminal/shared";

export interface FlashlightState {
  on: boolean;
  batteryS: number;
}

const seats: FlashlightState[] = [
  { on: false, batteryS: FLASHLIGHT_S },
  { on: false, batteryS: FLASHLIGHT_S },
];

export const flashlightFor = (seat: number): FlashlightState => seats[seat] ?? seats[0]!;

export function resetFlashlight(seat: number): void {
  const f = flashlightFor(seat);
  f.on = false;
  f.batteryS = FLASHLIGHT_S;
}
