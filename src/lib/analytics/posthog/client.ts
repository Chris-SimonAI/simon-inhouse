"use client";

import posthog from "posthog-js";
import type { AnalyticsClient, AnalyticsEventProps } from "../types";

let initialized = false;

export const PostHogBrowserClient: AnalyticsClient = {
  init() {
    if (initialized) return;

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (!apiKey) {
      console.warn("[analytics] NEXT_PUBLIC_POSTHOG_KEY missing; analytics disabled");
      return;
    }

    posthog.init(apiKey, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      // we capture exceptions in aws-rum
      capture_exceptions: false,
      person_profiles: "identified_only",
      capture_pageview: true,
      debug: process.env.NODE_ENV === "development",
    });

    initialized = true;
  },
  identify(userId: string, props?: AnalyticsEventProps) {
    if (!initialized) return;
    posthog.identify(userId, props);
  },
  reset() {
    if (!initialized) return;
    posthog.reset();
  },
  capture(event: string, props?: AnalyticsEventProps) {
    if (!initialized) return;
    posthog.capture(event, props);
  },
};

