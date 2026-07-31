import { describe, expect, it } from "vitest";
import { landingAttribution, stripSensitiveAnalyticsProperties } from "./analytics.js";

describe("landingAttribution", () => {
  it("keeps campaign attribution without exposing an invite room", () => {
    expect(
      landingAttribution(
        "https://play.example.com/?room=secret-room&utm_source=google&utm_campaign=backrooms",
        "https://www.google.com/search?q=multiplayer+backrooms",
      ),
    ).toEqual({
      entry: "invite",
      landing_path: "/",
      referrer_domain: "www.google.com",
      utm_campaign: "backrooms",
      utm_source: "google",
    });
  });

  it("ignores malformed referrers", () => {
    expect(landingAttribution("https://play.example.com/", "not a url")).toEqual({
      entry: "direct",
      landing_path: "/",
    });
  });
});

describe("stripSensitiveAnalyticsProperties", () => {
  it("removes URLs that can contain private room identifiers", () => {
    const event = stripSensitiveAnalyticsProperties({
      event: "landing_view",
      properties: {
        $current_url: "https://play.example.com/?room=secret-room",
        $referrer: "https://play.example.com/?room=another-secret",
        entry: "invite",
      },
      uuid: "test-event",
    });

    expect(event?.properties).toEqual({ entry: "invite" });
  });
});
