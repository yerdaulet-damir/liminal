import { FLASHLIGHT_S } from "@liminal/shared";

export interface FlashlightSnapshot {
  lit: boolean;
  flashlightS: number;
}

interface FlashlightRuntime extends FlashlightSnapshot {
  requested: boolean;
}

export class Flashlights {
  private readonly lights = new Map<string, FlashlightRuntime>();

  reset(playerIds: Iterable<string>): void {
    this.lights.clear();
    for (const id of playerIds) {
      this.lights.set(id, { requested: false, lit: false, flashlightS: FLASHLIGHT_S });
    }
  }

  add(id: string): void {
    if (!this.lights.has(id)) {
      this.lights.set(id, { requested: false, lit: false, flashlightS: FLASHLIGHT_S });
    }
  }

  remove(id: string): void {
    this.lights.delete(id);
  }

  request(id: string, lit: boolean): void {
    const light = this.lights.get(id);
    if (light) light.requested = lit;
  }

  tick(dt: number, enabled: boolean): void {
    for (const light of this.lights.values()) {
      light.lit = enabled && light.requested && light.flashlightS > 0;
      if (!light.lit) continue;
      light.flashlightS = Math.max(0, light.flashlightS - dt);
      if (light.flashlightS === 0) light.lit = false;
    }
  }

  state(id: string): FlashlightSnapshot {
    const light = this.lights.get(id);
    return light
      ? { lit: light.lit, flashlightS: light.flashlightS }
      : { lit: false, flashlightS: 0 };
  }
}
