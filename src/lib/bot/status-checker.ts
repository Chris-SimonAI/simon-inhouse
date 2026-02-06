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

export interface RestaurantStatus {
  isOpen: boolean;
  deliveryEta?: string; // e.g., "40 - 45 min"
  pickupEta?: string;
  closedMessage?: string; // e.g., "Opens at 11:00 AM"
  checkedAt: string;
}

/**
 * Lightweight status checker - just gets open/closed status and ETA
 * Much faster than full menu scrape (~5-10 seconds vs minutes)
 */
export async function checkRestaurantStatus(restaurantUrl: string): Promise<RestaurantStatus> {
  const startedAt = Date.now();
  let stage = "init";
  let cfDetected = false;
  let failReason: string | undefined;
  const proxyUrl = getScraperProxyUrl();
  const browser = await chromium.launch(buildChromiumLaunchOptions(proxyUrl));

  const context = await browser.newContext({
    userAgent: BOT_USER_AGENT,
    ignoreHTTPSErrors: Boolean(proxyUrl),
  });
  await applyAutomationInitScript(context);
  const page = await context.newPage();

  try {
    stage = "navigation";
    console.log(`Checking status for ${restaurantUrl}...`);

    await page.goto(restaurantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await stabilizePage(page);
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, "status_check"));

    // Check status and ETAs
    stage = "parse_status";
    const status = await page.evaluate(() => {
      const pageText = document.body.innerText || '';

      // Check if closed
      let isOpen = true;
      let closedMessage: string | undefined;

      const closedPatterns = [
        /currently\s+closed/i,
        /not\s+accepting\s+orders/i,
        /opens\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
        /closed/i,
      ];

      for (const pattern of closedPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          isOpen = false;
          if (match[1]) {
            closedMessage = `Opens at ${match[1]}`;
          } else if (pattern.source.includes('closed')) {
            closedMessage = 'Currently closed';
          }
          break;
        }
      }

      // Get delivery ETA - look for "Estimated in X - Y min" or similar
      let deliveryEta: string | undefined;
      const deliveryPatterns = [
        /delivery.*?(\d+\s*-\s*\d+\s*min)/i,
        /estimated\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
        /(\d+\s*-\s*\d+\s*min).*delivery/i,
      ];

      for (const pattern of deliveryPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          deliveryEta = match[1].trim();
          break;
        }
      }

      // Get pickup ETA
      let pickupEta: string | undefined;
      const pickupPatterns = [
        /pickup\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
        /pickup.*?(\d+\s*-\s*\d+\s*min)/i,
      ];

      for (const pattern of pickupPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          pickupEta = match[1].trim();
          break;
        }
      }

      return { isOpen, closedMessage, deliveryEta, pickupEta };
    });

    // If no delivery ETA found in initial view, try clicking Delivery tab
    if (!status.deliveryEta && status.isOpen) {
      try {
        stage = "delivery_eta_check";
        const deliveryTab = page.locator('button:has-text("Delivery"), [role="tab"]:has-text("Delivery")').first();
        if (await deliveryTab.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deliveryTab.click();
          await stabilizePage(page);
          cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, "status_check_delivery_tab"));

          // Re-check for delivery ETA
          const deliveryEta = await page.evaluate(() => {
            const pageText = document.body.innerText || '';
            const match = pageText.match(/estimated\s+in\s+(\d+\s*-\s*\d+\s*min)/i) ||
                          pageText.match(/(\d+\s*-\s*\d+\s*min)/i);
            return match ? match[1].trim() : undefined;
          });

          if (deliveryEta) {
            status.deliveryEta = deliveryEta;
          }
        }
      } catch {
        // Continue without delivery ETA
      }
    }

    console.log(`  Status: ${status.isOpen ? 'Open' : 'Closed'}, Delivery: ${status.deliveryEta || 'N/A'}`);

    return {
      ...status,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    failReason = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    logBotRunTelemetry({
      runType: "status-check",
      success: failReason === undefined,
      stage,
      cfDetected,
      proxyUsed: Boolean(proxyUrl),
      unlockerUsed: false,
      durationMs: Date.now() - startedAt,
      failReason,
      metadata: {
        url: restaurantUrl,
      },
    });
    await browser.close();
  }
}
