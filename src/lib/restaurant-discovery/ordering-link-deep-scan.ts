import "server-only";

import { chromium } from "playwright";
import { extractOrderingLinksFromWebsiteHtml } from "./order-link-extractor-core";
import { fingerprintOrderingPlatformFromHtml } from "./platform-fingerprinter-core";
import {
  type OrderingLinkDeepScanResult,
} from "./restaurant-discovery-types";

const orderCtaPatterns: RegExp[] = [
  /order online/i,
  /order now/i,
  /^order$/i,
  /online ordering/i,
  /delivery/i,
  /pickup/i,
];

const blockTextPatterns: RegExp[] = [
  /checking your browser/i,
  /attention required/i,
  /verify you are human/i,
  /access denied/i,
  /unusual traffic/i,
  /cloudflare/i,
  /captcha/i,
];

function nowIso() {
  return new Date().toISOString();
}

async function containsBlockSignals(page: import("playwright").Page) {
  const title = (await page.title().catch(() => "")) ?? "";
  if (blockTextPatterns.some((pattern) => pattern.test(title))) {
    return true;
  }

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 4000 })
    .catch(() => "");
  if (blockTextPatterns.some((pattern) => pattern.test(bodyText))) {
    return true;
  }

  return false;
}

async function bestEffortDismissOverlays(page: import("playwright").Page) {
  const patterns = [/accept/i, /agree/i, /got it/i, /continue/i, /^ok$/i] as const;
  for (const pattern of patterns) {
    const btn = page.getByRole("button", { name: pattern }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }
}

async function tryClickOrderCta(page: import("playwright").Page, notes: string[]) {
  // Prefer explicit button/link roles first.
  for (const pattern of orderCtaPatterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 4000 }).catch(() => undefined);
      notes.push(`Clicked button CTA (${pattern.toString()})`);
      return true;
    }

    const link = page.getByRole("link", { name: pattern }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click({ timeout: 4000 }).catch(() => undefined);
      notes.push(`Clicked link CTA (${pattern.toString()})`);
      return true;
    }
  }

  // Fallback: anchor containing 'order' in href.
  const hrefCandidates = [
    'a[href*="order"]',
    'a[href*="ordering"]',
    'a[href*="delivery"]',
  ];
  for (const selector of hrefCandidates) {
    const link = page.locator(selector).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click({ timeout: 4000 }).catch(() => undefined);
      notes.push(`Clicked link selector ${selector}`);
      return true;
    }
  }

  return false;
}

export async function deepScanOrderingLinks(options: {
  websiteUrl: string;
  maxCandidates: number;
  timeoutMs?: number;
}): Promise<OrderingLinkDeepScanResult> {
  const startedAt = nowIso();
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? 60_000;

  const notes: string[] = [];

  const result: OrderingLinkDeepScanResult = {
    inputUrl: options.websiteUrl,
    finalUrl: options.websiteUrl,
    startedAt,
    durationMs: 0,
    clickedOrderCta: false,
    fingerprint: null,
    orderingLinks: [],
    notes,
    errorMessage: null,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Math.min(timeoutMs, 30_000));

    await page.goto(options.websiteUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await bestEffortDismissOverlays(page);

    if (await containsBlockSignals(page)) {
      notes.push("Detected block/challenge signals on initial load");
      return result;
    }

    // Pass 1: fingerprint + link extraction on the homepage DOM as rendered.
    const initialHtml = await page.content();
    result.fingerprint = fingerprintOrderingPlatformFromHtml({
      websiteUrl: options.websiteUrl,
      html: initialHtml,
    });
    result.orderingLinks = extractOrderingLinksFromWebsiteHtml({
      websiteUrl: options.websiteUrl,
      html: initialHtml,
      maxCandidates: options.maxCandidates,
    });

    // If we already found ordering link candidates, no need for the deep click.
    // If we only found a fingerprint (scripts/iframes/meta), we still click through
    // because many sites hide ordering behind a CTA or modal.
    if (result.orderingLinks.length > 0) {
      notes.push("Static scan found signals; skipping deep click");
      result.finalUrl = page.url();
      return result;
    }

    // Pass 2: attempt to click into ordering.
    const clicked = await tryClickOrderCta(page, notes);
    result.clickedOrderCta = clicked;

    if (clicked) {
      // Wait for navigation or dynamic modal load to settle.
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await bestEffortDismissOverlays(page);

      if (await containsBlockSignals(page)) {
        notes.push("Detected block/challenge signals after clicking order CTA");
        result.finalUrl = page.url();
        return result;
      }
    } else {
      notes.push("No obvious order CTA found to click");
      result.finalUrl = page.url();
      return result;
    }

    const html = await page.content();
    result.finalUrl = page.url();
    result.fingerprint = fingerprintOrderingPlatformFromHtml({
      websiteUrl: result.finalUrl,
      html,
    });
    result.orderingLinks = extractOrderingLinksFromWebsiteHtml({
      websiteUrl: result.finalUrl,
      html,
      maxCandidates: options.maxCandidates,
    });
  } catch (error) {
    console.error("deepScanOrderingLinks error:", error);
    result.errorMessage = "Deep scan failed";
  } finally {
    result.durationMs = Date.now() - start;
    await browser.close().catch(() => undefined);
  }

  return result;
}
