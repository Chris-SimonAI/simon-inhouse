import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import {
  applyAutomationInitScript,
  BOT_USER_AGENT,
  buildChromiumLaunchOptions,
  ensureNoCloudflareBlock,
  getScraperProxyUrl,
  stabilizePage,
} from "@/lib/bot/browser-automation";
import { logBotRunTelemetry } from "@/lib/bot/bot-telemetry";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Simple test to check if Playwright can launch and fetch a page
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let stage = "init";
  let cfDetected = false;
  let failReason: string | undefined;
  const body = await request.json().catch(() => ({}));
  const url = body.url || "https://example.com";
  const skipProxy = body.skipProxy === true;

  console.log(`[ScraperTest] Testing with URL: ${url}, skipProxy: ${skipProxy}`);

  const proxyUrl = getScraperProxyUrl(skipProxy);
  console.log(`[ScraperTest] Proxy configured: ${!!proxyUrl}`);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    stage = "launch";
    console.log("[ScraperTest] Launching browser...");
    const launchOptions = buildChromiumLaunchOptions(proxyUrl);

    browser = await chromium.launch(launchOptions);
    console.log("[ScraperTest] Browser launched");

    const context = await browser.newContext({
      userAgent: BOT_USER_AGENT,
      ignoreHTTPSErrors: !!proxyUrl,
    });
    await applyAutomationInitScript(context);

    const page = await context.newPage();
    console.log("[ScraperTest] Page created");

    stage = "navigation";
    console.log("[ScraperTest] Navigating...");
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log("[ScraperTest] Navigation complete");

    await stabilizePage(page);
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, "scraper_test"));

    stage = "inspect";
    const title = await page.title().catch(() => 'TITLE_FAILED');
    const debugInfo = await page.evaluate(() => {
      return {
        hasBody: !!document.body,
        bodyText: document.body?.innerText?.substring(0, 300) || 'NO_BODY',
        html: document.documentElement?.outerHTML?.substring(0, 1000) || 'NO_HTML',
        readyState: document.readyState,
      };
    }).catch((e) => ({ error: String(e) }));

    await browser.close();
    browser = undefined;

    return NextResponse.json({
      ok: true,
      url,
      title,
      debugInfo,
      proxyUsed: !!proxyUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failReason = message;
    console.error(`[ScraperTest] Error: ${message}`);
    return NextResponse.json({
      ok: false,
      message,
      proxyConfigured: !!proxyUrl,
    }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    logBotRunTelemetry({
      runType: "scraper-test",
      success: failReason === undefined,
      stage,
      cfDetected,
      proxyUsed: Boolean(proxyUrl),
      unlockerUsed: false,
      durationMs: Date.now() - startedAt,
      failReason,
      metadata: {
        url,
        skipProxy,
      },
    });
  }
}
