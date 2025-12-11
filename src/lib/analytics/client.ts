"use client";

import type { AnalyticsEventProps } from "./types";
import { PostHogBrowserClient } from "./posthog/client";

export const Analytics = {
  init: () => PostHogBrowserClient.init(),
  identify: (userId: string, props?: AnalyticsEventProps) =>
    PostHogBrowserClient.identify(userId, props),
  reset: () => PostHogBrowserClient.reset(),
  capture: (event: string, props?: AnalyticsEventProps) =>
    PostHogBrowserClient.capture(event, props),
};
