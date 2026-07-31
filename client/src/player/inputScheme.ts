// Local co-op input. Two people, one laptop: seat 0 keeps mouse-look + WASD, seat 1 gets the
// arrow cluster (tank turn, because there is only one mouse) or its own gamepad.
// Pure read — no state, no listeners. The controller owns the keys map and calls this.

export interface SeatInput {
  /** -1..1 along the view direction */
  fwd: number;
  /** -1..1 sideways; always 0 on a tank seat */
  strafe: number;
  /** -1..1 body turn; always 0 on a mouse-look seat (the mouse owns yaw there) */
  turn: number;
  sprint: boolean;
  crouch: boolean;
}

interface Binding {
  fwd: string;
  back: string;
  left: string;
  right: string;
  sprint: string;
  crouch: string;
  torch: string;
  /** left/right turn the body instead of strafing — this seat has no mouse */
  tank: boolean;
}

export const SEAT_BINDINGS: readonly Binding[] = [
  {
    fwd: "KeyW",
    back: "KeyS",
    left: "KeyA",
    right: "KeyD",
    sprint: "ShiftLeft",
    crouch: "KeyC",
    torch: "KeyF",
    tank: false,
  },
  {
    fwd: "ArrowUp",
    back: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    sprint: "ShiftRight",
    crouch: "Slash",
    torch: "Period",
    tank: true,
  },
];

export const bindingFor = (seat: number): Binding => SEAT_BINDINGS[seat] ?? SEAT_BINDINGS[0]!;

/** Radians per second when a tank seat holds a turn key or pushes the stick fully. */
export const TURN_RATE = 2.4;

const DEADZONE = 0.18;
const axis = (v: number | undefined): number => (v === undefined || Math.abs(v) < DEADZONE ? 0 : v);

export function readSeatInput(seat: number, held: Record<string, boolean>): SeatInput {
  const b = bindingFor(seat);
  const sideways = (held[b.right] ? 1 : 0) - (held[b.left] ? 1 : 0);
  return withGamepad(seat, {
    fwd: (held[b.fwd] ? 1 : 0) - (held[b.back] ? 1 : 0),
    strafe: b.tank ? 0 : sideways,
    turn: b.tank ? -sideways : 0, // +yaw is a left turn in three.js
    sprint: !!held[b.sprint],
    crouch: !!held[b.crouch],
  });
}

// One pad per seat, in the order the browser reports them. A pad gives a tank seat real
// strafing back — that is the LEGO-couch setup: everyone holds their own controller.
function withGamepad(seat: number, keys: SeatInput): SeatInput {
  const pad = navigator.getGamepads?.()[seat];
  if (!pad?.connected) return keys;
  const strafe = axis(pad.axes[0]);
  const fwd = -axis(pad.axes[1]);
  const turn = -axis(pad.axes[2]);
  return {
    fwd: fwd || keys.fwd,
    strafe: strafe || keys.strafe,
    turn: turn || keys.turn,
    sprint: keys.sprint || !!pad.buttons[7]?.pressed, // right trigger
    crouch: keys.crouch || !!pad.buttons[1]?.pressed, // B / circle
  };
}
