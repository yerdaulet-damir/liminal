import { describe, expect, it } from "vitest";
import { resolvePartyHost } from "./socketConfig.js";

describe("party host selection", () => {
  it("requires configured infrastructure and ignores query overrides in production", () => {
    expect(
      resolvePartyHost({ production: true, configuredHost: "party.example.com", queryHost: "evil.test" }),
    ).toBe("party.example.com");
    expect(() =>
      resolvePartyHost({ production: true, configuredHost: "", queryHost: "evil.test" }),
    ).toThrow(/VITE_PARTY_HOST/);
  });

  it("allows an explicit query override only during development", () => {
    expect(
      resolvePartyHost({ production: false, configuredHost: "staging.test", queryHost: "127.0.0.1:1999" }),
    ).toBe("127.0.0.1:1999");
  });
});
