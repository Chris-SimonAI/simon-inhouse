import * as cheerio from "cheerio";
import {
  type OrderingPlatformFingerprint,
  type OrderingPlatformId,
  type OrderingPlatformSignal,
} from "./restaurant-discovery-types";
import { detectOrderingPlatformFromWebsite } from "./platform-detector";

type EvidenceSource = "script" | "iframe" | "link" | "meta" | "jsonld" | "text";

type EvidenceHit = {
  platform: OrderingPlatformSignal;
  source: EvidenceSource;
  url: string | null;
  note: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function resolveUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function signalKey(signal: OrderingPlatformSignal) {
  return signal.id;
}

function boostForSource(source: EvidenceSource) {
  if (source === "script" || source === "iframe") {
    return 3;
  }
  if (source === "link" || source === "meta" || source === "jsonld") {
    return 2;
  }
  return 1;
}

function toConfidenceFromScore(score: number): OrderingPlatformSignal["confidence"] {
  if (score >= 8) {
    return "high";
  }
  if (score >= 4) {
    return "medium";
  }
  return "low";
}

function buildReason(primaryId: OrderingPlatformId, hits: EvidenceHit[]) {
  const relevant = hits.filter((hit) => hit.platform.id === primaryId);
  const bySource = new Map<EvidenceSource, number>();
  for (const hit of relevant) {
    bySource.set(hit.source, (bySource.get(hit.source) ?? 0) + 1);
  }

  const parts: string[] = [];
  for (const [source, count] of bySource) {
    parts.push(`${count} ${source}`);
  }

  const sampleUrl = relevant.find((hit) => hit.url)?.url ?? null;

  return sampleUrl
    ? `Detected via ${parts.join(", ")} (e.g., ${sampleUrl})`
    : `Detected via ${parts.join(", ")}`;
}

export function fingerprintOrderingPlatformFromHtml(options: {
  websiteUrl: string;
  html: string;
  maxSignals?: number;
}): OrderingPlatformFingerprint | null {
  const $ = cheerio.load(options.html);
  const hits: EvidenceHit[] = [];

  $("script[src]").each((_idx, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const resolved = resolveUrl(options.websiteUrl, src);
    if (!resolved) return;
    const platform = detectOrderingPlatformFromWebsite(resolved);
    if (platform.id === "unknown") return;
    hits.push({ platform, source: "script", url: resolved, note: "script src" });
  });

  $("iframe[src]").each((_idx, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const resolved = resolveUrl(options.websiteUrl, src);
    if (!resolved) return;
    const platform = detectOrderingPlatformFromWebsite(resolved);
    if (platform.id === "unknown") return;
    hits.push({ platform, source: "iframe", url: resolved, note: "iframe src" });
  });

  $("link[href]").each((_idx, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = resolveUrl(options.websiteUrl, href);
    if (!resolved) return;
    const platform = detectOrderingPlatformFromWebsite(resolved);
    if (platform.id === "unknown") return;
    hits.push({ platform, source: "link", url: resolved, note: "link href" });
  });

  $("meta[content]").each((_idx, el) => {
    const content = $(el).attr("content");
    if (!content) return;
    const trimmed = content.trim();
    if (!trimmed.startsWith("http")) return;
    const platform = detectOrderingPlatformFromWebsite(trimmed);
    if (platform.id === "unknown") return;
    hits.push({ platform, source: "meta", url: trimmed, note: "meta content" });
  });

  $('script[type="application/ld+json"]').each((_idx, el) => {
    const text = $(el).text();
    const normalized = normalizeWhitespace(text);
    if (normalized.length === 0) return;
    const urls = normalized.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    for (const url of urls) {
      const platform = detectOrderingPlatformFromWebsite(url);
      if (platform.id === "unknown") continue;
      hits.push({ platform, source: "jsonld", url, note: "json-ld url" });
    }
  });

  const bodyText = normalizeWhitespace($("body").text());
  if (/powered by slice/i.test(bodyText) || /slice may deliver/i.test(bodyText)) {
    hits.push({
      platform: {
        id: "slice",
        label: "Slice",
        confidence: "medium",
        reason: "Text marker indicates Slice",
      },
      source: "text",
      url: null,
      note: "powered by slice",
    });
  }

  if (hits.length === 0) {
    return null;
  }

  const scores = new Map<OrderingPlatformId, number>();
  const representative = new Map<OrderingPlatformId, OrderingPlatformSignal>();

  for (const hit of hits) {
    const key = signalKey(hit.platform);
    const boost = boostForSource(hit.source);
    scores.set(key, (scores.get(key) ?? 0) + boost);
    if (!representative.has(key)) {
      representative.set(key, hit.platform);
    }
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const [primaryId, primaryScore] = ranked[0] ?? [];
  if (!primaryId || primaryScore === undefined) {
    return null;
  }

  const signals: OrderingPlatformSignal[] = ranked
    .slice(0, options.maxSignals ?? 4)
    .map(([id, score]) => {
      const base = representative.get(id) ?? {
        id,
        label: id,
        confidence: "low",
        reason: "Fingerprint signal",
      };
      const confidence = toConfidenceFromScore(score);
      return {
        ...base,
        confidence,
        reason: buildReason(id, hits),
      };
    });

  const primaryBase = representative.get(primaryId) ?? signals[0]!;
  const primary: OrderingPlatformSignal = {
    ...primaryBase,
    confidence: toConfidenceFromScore(primaryScore),
    reason: buildReason(primaryId, hits),
  };

  return { primary, signals };
}

