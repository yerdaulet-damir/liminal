import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external";

export type AnalyticsEvent =
  | "couch_game_started"
  | "invite_join_started"
  | "invite_link_copied"
  | "landing_view"
  | "private_room_created"
  | "quick_play_matched"
  | "quick_play_started";

type AnalyticsProperties = Record<string, boolean | number | string>;

let posthogPromise: Promise<PostHog | null> | null = null;
let landingViewCaptured = false;

function analyticsConfig(): { host: string; key: string } | null {
  const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
  const host = import.meta.env.VITE_POSTHOG_HOST?.trim().replace(/\/$/, "");
  if (!import.meta.env.PROD || !key || !host) return null;
  return { host, key };
}

export function landingAttribution(
  href: string,
  referrer: string,
): AnalyticsProperties {
  const url = new URL(href);
  const properties: AnalyticsProperties = {
    entry: url.searchParams.has("room") ? "invite" : "direct",
    landing_path: url.pathname,
  };

  const campaignKeys = [
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
  ] as const;
  for (const key of campaignKeys) {
    const value = url.searchParams.get(key)?.slice(0, 100);
    if (value) properties[key] = value;
  }

  if (referrer) {
    try {
      const referrerHost = new URL(referrer).hostname;
      if (referrerHost && referrerHost !== url.hostname) properties.referrer_domain = referrerHost;
    } catch {
      // Browsers normally provide an absolute referrer. Ignore malformed values.
    }
  }
  return properties;
}

export function stripSensitiveAnalyticsProperties(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return null;
  const properties = event.properties;
  for (const key of [
    "$current_url",
    "$initial_current_url",
    "$initial_referrer",
    "$initial_referring_domain",
    "$referrer",
    "$referring_domain",
  ]) {
    delete properties[key];
  }
  return event;
}

async function loadPostHog(): Promise<PostHog | null> {
  const config = analyticsConfig();
  if (!config) return null;

  await new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 2_000 });
    } else {
      setTimeout(resolve, 1_000);
    }
  });

  const { default: posthog } = await import("posthog-js/dist/module.no-external");
  posthog.init(config.key, {
    api_host: config.host,
    autocapture: false,
    before_send: stripSensitiveAnalyticsProperties,
    capture_pageleave: false,
    capture_pageview: false,
    cookieless_mode: "always",
    defaults: "2026-05-30",
    disable_session_recording: true,
    person_profiles: "never",
    respect_dnt: true,
  });
  return posthog;
}

function posthogClient(): Promise<PostHog | null> {
  posthogPromise ??= loadPostHog().catch(() => null);
  return posthogPromise;
}

export function trackAnalytics(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  void posthogClient().then((posthog) => posthog?.capture(event, properties));
}

export function trackLandingView(): void {
  if (landingViewCaptured) return;
  landingViewCaptured = true;
  trackAnalytics("landing_view", landingAttribution(location.href, document.referrer));
}
