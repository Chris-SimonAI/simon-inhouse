import * as cheerio from "cheerio";
import {
  type OrderingLinkCandidate,
  type OrderingPlatformSignal,
} from "./restaurant-discovery-types";
import { detectOrderingPlatformFromWebsite } from "./platform-detector";

const orderingTextHints = [
  "order",
  "online ordering",
  "delivery",
  "pickup",
  "takeout",
  "carryout",
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function safeHostFromUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function resolveUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function scoreCandidateUrl(
  resolvedUrl: string,
  text: string,
  platform: OrderingPlatformSignal,
) {
  const normalizedText = text.toLowerCase();
  const normalizedUrl = resolvedUrl.toLowerCase();

  let score = 0;

  if (orderingTextHints.some((hint) => normalizedText.includes(hint))) {
    score += 25;
  }

  if (normalizedUrl.includes("/order") || normalizedUrl.includes("ordering")) {
    score += 15;
  }

  if (platform.id !== "unknown" && platform.id !== "other") {
    score += platform.confidence === "high" ? 40 : 30;
  }

  if (normalizedText.includes("gift card") || normalizedText.includes("catering")) {
    score -= 20;
  }

  if (normalizedUrl.includes("instagram.com") || normalizedUrl.includes("facebook.com")) {
    score -= 50;
  }

  return score;
}

function toCandidateLabel(text: string, url: string, platform: OrderingPlatformSignal) {
  const trimmed = normalizeWhitespace(text);
  if (trimmed.length > 0) {
    return trimmed.slice(0, 80);
  }

  if (platform.id !== "unknown" && platform.id !== "other") {
    return `${platform.label} ordering`;
  }

  return url;
}

export function extractOrderingLinksFromWebsiteHtml(options: {
  websiteUrl: string;
  html: string;
  maxCandidates: number;
}): OrderingLinkCandidate[] {
  const $ = cheerio.load(options.html);

  const rawLinks: Array<{ href: string; text: string }> = [];

  $("a[href]").each((_idx, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const trimmedHref = href.trim();
    if (
      trimmedHref.length === 0 ||
      trimmedHref.startsWith("#") ||
      trimmedHref.startsWith("mailto:") ||
      trimmedHref.startsWith("tel:") ||
      trimmedHref.startsWith("javascript:")
    ) {
      return;
    }

    const text = normalizeWhitespace($(element).text());
    rawLinks.push({ href: trimmedHref, text });
  });

  const candidates = rawLinks
    .map((link) => {
      const resolvedUrl = resolveUrl(options.websiteUrl, link.href);
      if (!resolvedUrl) {
        return null;
      }

      const host = safeHostFromUrl(resolvedUrl);
      const platform = detectOrderingPlatformFromWebsite(resolvedUrl);
      const score = scoreCandidateUrl(resolvedUrl, link.text, platform);
      const label = toCandidateLabel(link.text, resolvedUrl, platform);

      return {
        url: resolvedUrl,
        host,
        label,
        score,
        platform,
        source: "website",
      } satisfies OrderingLinkCandidate;
    })
    .filter((value): value is OrderingLinkCandidate => value !== null)
    .filter((candidate) => candidate.score > 0);

  // Sort by score desc, then stable by url.
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.url.localeCompare(b.url);
  });

  const deduped = new Map<string, OrderingLinkCandidate>();
  for (const candidate of candidates) {
    if (deduped.has(candidate.url)) {
      continue;
    }
    deduped.set(candidate.url, candidate);
    if (deduped.size >= options.maxCandidates) {
      break;
    }
  }

  return Array.from(deduped.values());
}

