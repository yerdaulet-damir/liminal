// Tiny module store for the flashlight so the HUD (outside the Canvas) can read battery
// without prop-drilling through the scene graph.

import { FLASHLIGHT_S } from "@liminal/shared";

export const flashlight = {
  on: false,
  batteryS: FLASHLIGHT_S,
};

export function resetFlashlight(): void {
  flashlight.on = false;
  flashlight.batteryS = FLASHLIGHT_S;
}
