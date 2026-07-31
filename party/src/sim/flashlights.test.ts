import { describe, expect, it } from "vitest";
import { FLASHLIGHT_S } from "@liminal/shared";
import { Flashlights } from "./flashlights.js";

describe("authoritative flashlight budget", () => {
  it("treats client light as intent and forces it off when the server budget drains", () => {
    const lights = new Flashlights();
    lights.reset(["p1"]);
    lights.request("p1", true);

    lights.tick(FLASHLIGHT_S - 0.25, true);
    expect(lights.state("p1")).toEqual({ lit: true, flashlightS: 0.25 });
    lights.tick(0.5, true);
    expect(lights.state("p1")).toEqual({ lit: false, flashlightS: 0 });
  });

  it("does not drain outside the flashlight level", () => {
    const lights = new Flashlights();
    lights.reset(["p1"]);
    lights.request("p1", true);
    lights.tick(10, false);
    expect(lights.state("p1")).toEqual({ lit: false, flashlightS: FLASHLIGHT_S });
  });
});
