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
  const skipProxy = body.skipProxy === true;

  console.log(`[ScraperTest] Testing with URL: ${url}, skipProxy: ${skipProxy}`);

  const proxyUrl = skipProxy ? null : process.env.SCRAPER_PROXY_URL;
  console.log(`[ScraperTest] Proxy configured: ${!!proxyUrl}`);

  try {
    console.log("[ScraperTest] Launching browser...");
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--disable-blink-features=AutomationControlled'],
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log("[ScraperTest] Navigation complete");

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle').catch(() => {});

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

    return NextResponse.json({
      ok: true,
      url,
      title,
      debugInfo,
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
