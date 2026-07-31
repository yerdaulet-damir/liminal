// Local input intent only. The room owns whether the beam is actually lit and how
// much battery remains; authoritative snapshots must never be written back here.
export interface FlashlightIntent {
  requested: boolean;
}

const seats: FlashlightIntent[] = [
  { requested: false },
  { requested: false },
];

export const flashlightIntentFor = (seat: number): FlashlightIntent => seats[seat] ?? seats[0]!;

export function resetFlashlightIntent(seat: number): void {
  flashlightIntentFor(seat).requested = false;
}
