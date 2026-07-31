// The whole point of two seats is that one keyboard drives two people without collisions.
import { describe, expect, it } from "vitest";
import { bindingFor, readSeatInput } from "./inputScheme.js";

describe("seat input", () => {
  it("gives seat 0 mouse-look strafing and seat 1 a tank turn", () => {
    expect(readSeatInput(0, { KeyD: true })).toMatchObject({ strafe: 1, turn: 0 });
    expect(readSeatInput(1, { ArrowRight: true })).toMatchObject({ strafe: 0, turn: -1 });
    expect(readSeatInput(1, { ArrowLeft: true }).turn).toBe(1); // +yaw is a left turn
  });

  it("keeps the two seats' keys disjoint", () => {
    const held = { KeyW: true, ShiftLeft: true, KeyC: true };
    expect(readSeatInput(0, held)).toMatchObject({ fwd: 1, sprint: true, crouch: true });
    expect(readSeatInput(1, held)).toMatchObject({ fwd: 0, sprint: false, crouch: false });
  });

  it("falls back to the mouse-look seat for an unknown seat", () => {
    expect(bindingFor(7)).toBe(bindingFor(0));
  });
});
