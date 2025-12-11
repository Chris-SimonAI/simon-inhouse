import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/env";
import type { AnalyticsServer, AnalyticsEventProps } from "../types";

let client: PostHog | null = null;
let noop = false;

const getClient = () => {
  if (noop) return null;
  if (client) return client;

  if (!env.POSTHOG_KEY) {
    noop = true;
    console.warn("[analytics] POSTHOG_KEY missing; server analytics disabled");
    return null;
  }

  client = new PostHog(env.POSTHOG_KEY, {
    host: "https://us.posthog.com",
    // geoip is disabled by default, but we want to track the user's location
    disableGeoip: false,
  });

  return client;
};

export const PostHogServerClient: AnalyticsServer = {
  async capture(distinctId: string, event: string, props?: AnalyticsEventProps) {
    const posthog = getClient();
    if (!posthog) return;

    posthog.capture({
      distinctId,
      event,
      properties: props,
    });

    await posthog.flush();
  },
};

