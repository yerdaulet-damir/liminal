import { describe, expect, it } from "vitest";
import { SPRINT_MS } from "@liminal/shared";
import { tickMovementMode, type SprintState } from "./movementMode.js";

const freshSprint = (): SprintState => ({ budgetMs: SPRINT_MS, cdMs: 0 });

describe("movement intent mode", () => {
  it("gives crouch priority over a simultaneous sprint request", () => {
    expect(tickMovementMode(true, true, true, 16, freshSprint())).toBe("crouch");
  });

  it("reports sprint only while local sprint is actually active", () => {
    const state = freshSprint();

    expect(tickMovementMode(false, true, false, 16, state)).toBe("walk");
    expect(tickMovementMode(false, true, true, 16, state)).toBe("sprint");
    expect(state.budgetMs).toBe(SPRINT_MS - 16);
  });

  it("falls back to walk while sprint is cooling down", () => {
    const state = { budgetMs: 0, cdMs: 100 };

    expect(tickMovementMode(false, true, true, 16, state)).toBe("walk");
    expect(state.cdMs).toBe(84);
  });
});
