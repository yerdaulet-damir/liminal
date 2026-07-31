import {
  CROUCH_SPEED,
  SPRINT_CD_MS,
  SPRINT_MS,
  SPRINT_SPEED,
  WALK_SPEED,
  type MovementMode,
} from "@liminal/shared";

export interface SprintState {
  budgetMs: number;
  cdMs: number;
}

export function tickMovementMode(
  crouching: boolean,
  sprintRequested: boolean,
  moving: boolean,
  dtMs: number,
  state: SprintState,
): MovementMode {
  let mode: MovementMode = crouching ? "crouch" : "walk";
  if (!crouching && sprintRequested && moving && state.cdMs <= 0 && state.budgetMs > 0) {
    mode = "sprint";
    state.budgetMs -= dtMs;
    if (state.budgetMs <= 0) state.cdMs = SPRINT_CD_MS;
  }
  recoverSprint(mode, dtMs, state);
  return mode;
}

export function speedForMovementMode(mode: MovementMode): number {
  if (mode === "crouch") return CROUCH_SPEED;
  if (mode === "sprint") return SPRINT_SPEED;
  return WALK_SPEED;
}

function recoverSprint(mode: MovementMode, dtMs: number, state: SprintState): void {
  if (state.cdMs > 0) {
    state.cdMs -= dtMs;
    if (state.cdMs <= 0) state.budgetMs = SPRINT_MS;
  } else if (mode !== "sprint" && state.budgetMs < SPRINT_MS) {
    state.budgetMs = Math.min(SPRINT_MS, state.budgetMs + dtMs * 0.5);
  }
}
