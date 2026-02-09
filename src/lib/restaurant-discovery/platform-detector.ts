import "server-only";

import {
  type OrderingPlatformId,
  type OrderingPlatformSignal,
} from "./restaurant-discovery-types";

function hostIncludes(host: string, needle: string) {
  return host.toLowerCase().includes(needle.toLowerCase());
}

function hostEndsWith(host: string, suffix: string) {
  return host.toLowerCase().endsWith(suffix.toLowerCase());
}

export function detectOrderingPlatformFromWebsite(
  websiteUrl: string | null,
): OrderingPlatformSignal {
  if (!websiteUrl) {
    return {
      id: "unknown",
      label: "Unknown",
      confidence: "low",
      reason: "No website URL available",
    };
  }

  let host: string | null = null;
  try {
    host = new URL(websiteUrl).hostname;
  } catch {
    return {
      id: "unknown",
      label: "Unknown",
      confidence: "low",
      reason: "Website URL is not a valid URL",
    };
  }

  const normalizedHost = host.toLowerCase();

  const known: Array<{
    id: OrderingPlatformId;
    label: string;
    confidence: OrderingPlatformSignal["confidence"];
    reason: string;
    match: (h: string) => boolean;
  }> = [
    {
      id: "toast",
      label: "Toast",
      confidence: "high",
      reason: "Domain matches toast ordering",
      match: (h) => hostIncludes(h, "toasttab.com"),
    },
    {
      id: "chownow",
      label: "ChowNow",
      confidence: "high",
      reason: "Domain matches ChowNow ordering",
      match: (h) => hostIncludes(h, "chownow.com"),
    },
    {
      id: "slice",
      label: "Slice",
      confidence: "medium",
      reason: "Domain matches Slice ordering/whitelabel",
      match: (h) =>
        hostIncludes(h, "slice") ||
        hostEndsWith(h, "slice.com") ||
        hostEndsWith(h, "orderonline.ai"),
    },
    {
      id: "olo",
      label: "Olo",
      confidence: "medium",
      reason: "Domain matches Olo ordering",
      match: (h) => hostIncludes(h, "olo.com") || hostIncludes(h, "oloorder"),
    },
    {
      id: "square",
      label: "Square",
      confidence: "medium",
      reason: "Domain matches Square ordering",
      match: (h) =>
        hostEndsWith(h, "square.site") ||
        hostIncludes(h, "squareup.com") ||
        hostIncludes(h, "square.online"),
    },
    {
      id: "clover",
      label: "Clover",
      confidence: "medium",
      reason: "Domain matches Clover ordering",
      match: (h) => hostIncludes(h, "clover.com") || hostIncludes(h, "clover"),
    },
    {
      id: "bentobox",
      label: "BentoBox",
      confidence: "medium",
      reason: "Domain matches BentoBox ordering",
      match: (h) => hostIncludes(h, "getbento.com") || hostIncludes(h, "bento"),
    },
    {
      id: "popmenu",
      label: "Popmenu",
      confidence: "medium",
      reason: "Domain matches Popmenu ordering",
      match: (h) => hostIncludes(h, "popmenu.com") || hostIncludes(h, "popmenu"),
    },
  ];

  const matched = known.find((entry) => entry.match(normalizedHost));
  if (matched) {
    return {
      id: matched.id,
      label: matched.label,
      confidence: matched.confidence,
      reason: matched.reason,
    };
  }

  return {
    id: "other",
    label: "Other",
    confidence: "low",
    reason: `Unrecognized domain: ${normalizedHost}`,
  };
}

