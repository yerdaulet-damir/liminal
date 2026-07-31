import { beforeEach, describe, expect, it } from "vitest";
import { flashlightIntentFor, resetFlashlightIntent } from "./flashlight.js";

describe("flashlight input intent", () => {
  beforeEach(() => {
    resetFlashlightIntent(0);
    resetFlashlightIntent(1);
  });

  it("stores requested input independently for each local seat", () => {
    flashlightIntentFor(0).requested = true;

    expect(flashlightIntentFor(0).requested).toBe(true);
    expect(flashlightIntentFor(1).requested).toBe(false);
  });

  it("resets only desired input, without inventing battery state", () => {
    flashlightIntentFor(1).requested = true;
    resetFlashlightIntent(1);

    expect(flashlightIntentFor(1)).toEqual({ requested: false });
  });
});
