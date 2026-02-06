import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Simple test to check if Playwright can launch and fetch a page
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const url = body.url || "https://example.com";

  console.log(`[ScraperTest] Testing with URL: ${url}`);

  const proxyUrl = process.env.SCRAPER_PROXY_URL;
  console.log(`[ScraperTest] Proxy configured: ${!!proxyUrl}`);

  try {
    console.log("[ScraperTest] Launching browser...");
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    };

    if (proxyUrl) {
      const parsed = new URL(proxyUrl);
      launchOptions.proxy = {
        server: `${parsed.protocol}//${parsed.host}`,
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
    }

    const browser = await chromium.launch(launchOptions);
    console.log("[ScraperTest] Browser launched");

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ignoreHTTPSErrors: !!proxyUrl,
    });

    const page = await context.newPage();
    console.log("[ScraperTest] Page created");

    console.log("[ScraperTest] Navigating...");
    await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
    console.log("[ScraperTest] Navigation complete");

    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => 'TITLE_FAILED');
    const bodyText = await page.evaluate(() => {
      return document.body?.innerText?.substring(0, 200) || 'NO_BODY';
    }).catch(() => 'EVAL_FAILED');

    await browser.close();

    return NextResponse.json({
      ok: true,
      url,
      title,
      bodyText,
      proxyUsed: !!proxyUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ScraperTest] Error: ${message}`);
    return NextResponse.json({
      ok: false,
      message,
      proxyConfigured: !!proxyUrl,
    }, { status: 500 });
  }
}
