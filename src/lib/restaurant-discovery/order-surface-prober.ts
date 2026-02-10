import "server-only";

import { chromium } from "playwright";

export type OrderSurfaceProbeResult = {
  url: string;
  startedAt: string;
  durationMs: number;
  providerHint: "slice" | "toast" | "chownow" | "unknown";
  passed: boolean;
  checks: {
    reachedSite: boolean;
    botBlocked: boolean;
    addedItemToCart: boolean;
    reachedCheckout: boolean;
    guestCardEntryVisible: boolean;
    loginRequiredForCard: boolean;
    walletOnly: boolean;
  };
  notes: string[];
  errorMessage: string | null;
};

const blockTextPatterns: RegExp[] = [
  /checking your browser/i,
  /attention required/i,
  /verify you are human/i,
  /access denied/i,
  /unusual traffic/i,
  /cloudflare/i,
  /robot/i,
  /captcha/i,
];

function nowIso() {
  return new Date().toISOString();
}

function toProviderHint(url: string): OrderSurfaceProbeResult["providerHint"] {
  const lower = url.toLowerCase();
  if (lower.includes("toasttab.com")) {
    return "toast";
  }
  if (lower.includes("chownow.com")) {
    return "chownow";
  }
  if (lower.includes("slice")) {
    return "slice";
  }
  return "unknown";
}

async function containsBlockSignals(page: import("playwright").Page) {
  const title = (await page.title().catch(() => "")) ?? "";
  if (blockTextPatterns.some((pattern) => pattern.test(title))) {
    return true;
  }

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 3000 })
    .catch(() => "");
  if (blockTextPatterns.some((pattern) => pattern.test(bodyText))) {
    return true;
  }

  return false;
}

async function clickFirstButtonByName(
  page: import("playwright").Page,
  pattern: RegExp,
) {
  const button = page.getByRole("button", { name: pattern }).first();
  if ((await button.count().catch(() => 0)) === 0) {
    return false;
  }
  if (!(await button.isVisible().catch(() => false))) {
    return false;
  }
  await button.click({ timeout: 2000 }).catch(() => undefined);
  return true;
}

async function bestEffortDismissOverlays(page: import("playwright").Page) {
  const patterns = [
    /accept/i,
    /agree/i,
    /got it/i,
    /continue/i,
    /ok/i,
  ] as const;

  for (const pattern of patterns) {
    const clicked = await clickFirstButtonByName(page, pattern);
    if (clicked) {
      await page.waitForTimeout(250);
    }
  }
}

async function tryAddFirstItem(page: import("playwright").Page, notes: string[]) {
  const addPatterns = [/add to cart/i, /^add$/i, /add item/i];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const pattern of addPatterns) {
      const button = page.getByRole("button", { name: pattern }).first();
      const visible = await button.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      await button.click({ timeout: 3000 }).catch(() => undefined);
      notes.push(`Clicked add button (${pattern.toString()})`);
      await page.waitForTimeout(600);

      // Some flows open an item editor modal; try to confirm add.
      const confirm =
        (await clickFirstButtonByName(page, /add to cart/i)) ||
        (await clickFirstButtonByName(page, /add to order/i));
      if (confirm) {
        notes.push("Confirmed add in item editor");
        await page.waitForTimeout(600);
      }

      // Heuristic: if we can see checkout/cart button afterwards, consider it added.
      const checkoutVisible = await page
        .getByRole("button", { name: /checkout/i })
        .first()
        .isVisible()
        .catch(() => false);
      if (checkoutVisible) {
        return true;
      }

      const cartVisible = await page
        .getByRole("button", { name: /cart/i })
        .first()
        .isVisible()
        .catch(() => false);
      if (cartVisible) {
        return true;
      }

      // Try again after scrolling a bit.
      await page.mouse.wheel(0, 800).catch(() => undefined);
    }
  }

  return false;
}

async function tryReachCheckout(page: import("playwright").Page, notes: string[]) {
  const navigators: Array<RegExp> = [
    /checkout/i,
    /view cart/i,
    /go to cart/i,
    /^cart$/i,
  ];

  for (const pattern of navigators) {
    const clicked = await clickFirstButtonByName(page, pattern);
    if (clicked) {
      notes.push(`Clicked navigation button (${pattern.toString()})`);
      await page.waitForTimeout(800);
      return true;
    }
  }

  // Anchor fallback (common on some providers).
  const checkoutLink = page.locator('a[href*="checkout"]').first();
  if (await checkoutLink.isVisible().catch(() => false)) {
    await checkoutLink.click({ timeout: 2000 }).catch(() => undefined);
    notes.push('Clicked checkout link (href contains "checkout")');
    await page.waitForTimeout(800);
    return true;
  }

  return false;
}

async function detectPaymentCapabilities(page: import("playwright").Page) {
  const guestCardFields = [
    /card number/i,
    /mm\/yy/i,
    /expiry/i,
    /cvc/i,
    /cvv/i,
    /zip/i,
    /postal/i,
  ];

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 4000 })
    .catch(() => "");

  const hasCardInputs =
    (await page.locator('input[placeholder*="Card"]').count().catch(() => 0)) > 0 ||
    (await page.locator('input[name*="card"]').count().catch(() => 0)) > 0;

  const hasMultipleCardHints =
    guestCardFields.filter((pattern) => pattern.test(bodyText)).length >= 3;

  const guestCardEntryVisible = hasCardInputs || hasMultipleCardHints;

  const loginRequiredForCard =
    /add credit card/i.test(bodyText) && /log in/i.test(bodyText);

  const walletOnly =
    /google pay/i.test(bodyText) &&
    !guestCardEntryVisible &&
    !/credit\/debit card/i.test(bodyText) &&
    !/card number/i.test(bodyText);

  return {
    guestCardEntryVisible,
    loginRequiredForCard,
    walletOnly,
  };
}

export async function probeOrderSurface(options: {
  url: string;
  timeoutMs?: number;
}): Promise<OrderSurfaceProbeResult> {
  const startedAt = nowIso();
  const start = Date.now();
  const notes: string[] = [];
  const providerHint = toProviderHint(options.url);

  const timeoutMs = options.timeoutMs ?? 60_000;

  const result: OrderSurfaceProbeResult = {
    url: options.url,
    startedAt,
    durationMs: 0,
    providerHint,
    passed: false,
    checks: {
      reachedSite: false,
      botBlocked: false,
      addedItemToCart: false,
      reachedCheckout: false,
      guestCardEntryVisible: false,
      loginRequiredForCard: false,
      walletOnly: false,
    },
    notes,
    errorMessage: null,
  };

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    page.setDefaultTimeout(Math.min(timeoutMs, 30_000));

    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    result.checks.reachedSite = true;

    await bestEffortDismissOverlays(page);

    const blocked = await containsBlockSignals(page);
    if (blocked) {
      result.checks.botBlocked = true;
      notes.push("Detected block/challenge signals on initial load");
      return result;
    }

    const added = await tryAddFirstItem(page, notes);
    result.checks.addedItemToCart = added;
    if (!added) {
      notes.push("Could not confidently add an item to cart");
    }

    const reachedCheckout = await tryReachCheckout(page, notes);
    result.checks.reachedCheckout = reachedCheckout;

    // If we didn't reach checkout, still try to detect payment fields in case the URL was already on checkout.
    await page.waitForTimeout(600);
    const payment = await detectPaymentCapabilities(page);
    result.checks.guestCardEntryVisible = payment.guestCardEntryVisible;
    result.checks.loginRequiredForCard = payment.loginRequiredForCard;
    result.checks.walletOnly = payment.walletOnly;

    // We consider this a "pass" if guest card entry is visible without a login gate.
    result.passed =
      result.checks.guestCardEntryVisible && !result.checks.loginRequiredForCard;

    if (result.checks.walletOnly) {
      notes.push("Payment appears to be wallet-only (no visible guest card entry)");
    }

    if (result.passed) {
      notes.push("Pass: guest card entry appears available without login");
    } else {
      notes.push("Fail: guest card entry not detected (or login appears required)");
    }
  } catch (error) {
    console.error("Order surface probe error:", error);
    result.errorMessage = "Probe failed to complete";
  } finally {
    result.durationMs = Date.now() - start;
    await browser.close().catch(() => undefined);
  }

  return result;
}

