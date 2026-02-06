import type { BrowserContext, LaunchOptions, Page } from "playwright";
import { env } from "@/env";

const DEFAULT_CLOUDFLARE_WAIT_MS = 30000;
const DEFAULT_STABILIZE_DELAY_MS = 2000;

export const BOT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getScraperProxyUrl(skipProxy = false): string | undefined {
  if (skipProxy) {
    return undefined;
  }

  return env.SCRAPER_PROXY_URL;
}

export function buildChromiumLaunchOptions(proxyUrl?: string): LaunchOptions {
  const launchOptions: LaunchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
    ],
  };

  if (!proxyUrl) {
    return launchOptions;
  }

  const parsed = new URL(proxyUrl);
  launchOptions.proxy = {
    server: `${parsed.protocol}//${parsed.host}`,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };

  return launchOptions;
}

export async function applyAutomationInitScript(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
  });
}

export async function isCloudflareChallengeVisible(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (/just a moment|attention required/i.test(title)) {
    return true;
  }

  const challengeSignals = await page
    .evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || "";
      const html = document.body?.innerHTML?.toLowerCase() || "";
      const hasTurnstile =
        document.querySelector('iframe[src*="turnstile"], div[class*="cf-turnstile"]') !== null;

      return (
        hasTurnstile ||
        text.includes("verify you are human") ||
        text.includes("checking your browser") ||
        text.includes("attention required") ||
        text.includes("just a moment") ||
        html.includes("cloudflare") ||
        html.includes("cf-browser-verification") ||
        html.includes("cf-ray")
      );
    })
    .catch(() => false);

  return challengeSignals;
}

export async function waitForCloudflareChallengeToClear(
  page: Page,
  contextLabel: string,
  maxWaitMs: number = DEFAULT_CLOUDFLARE_WAIT_MS,
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const blocked = await isCloudflareChallengeVisible(page);
    if (!blocked) {
      return true;
    }

    console.log(`  [${contextLabel}] Cloudflare challenge active, waiting...`);

    await page
      .evaluate(() => {
        const checkbox = document.querySelector("input[type='checkbox']") as HTMLInputElement | null;
        if (checkbox && !checkbox.disabled) {
          checkbox.click();
        }

        const verifyButton = Array.from(document.querySelectorAll("button")).find((button) => {
          const text = button.textContent?.toLowerCase() || "";
          return text.includes("verify") || text.includes("human");
        });

        if (verifyButton) {
          (verifyButton as HTMLButtonElement).click();
        }
      })
      .catch(() => {});

    await delay(2000);
  }

  return false;
}

export async function ensureNoCloudflareBlock(
  page: Page,
  contextLabel: string,
  maxWaitMs: number = DEFAULT_CLOUDFLARE_WAIT_MS,
): Promise<boolean> {
  const blocked = await isCloudflareChallengeVisible(page);
  if (!blocked) {
    return false;
  }

  const cleared = await waitForCloudflareChallengeToClear(page, contextLabel, maxWaitMs);
  if (!cleared) {
    throw new Error(`Cloudflare challenge persisted during ${contextLabel}`);
  }

  return true;
}

export async function stabilizePage(page: Page): Promise<void> {
  await delay(DEFAULT_STABILIZE_DELAY_MS);
  await page.waitForLoadState("networkidle").catch(() => {});
}
