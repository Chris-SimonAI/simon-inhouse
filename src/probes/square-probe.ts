import path from "node:path";
import * as cheerio from "cheerio";
import { chromium, type Page, type Response } from "playwright";
import { delay, nowIso, pickWafHeaders, safeSlug, writeJson } from "./probe-utils";

export type SquareOnlineProbeResult = {
  target: {
    url: string;
    domain: string;
    platform: "square_online";
  };

  pageLoad: {
    success: boolean;
    loadTimeMs: number;
    jsRenderRequired: boolean;
    botDetectionEncountered: boolean;
    botDetectionType?: string;
    wafHeaders: Record<string, string>;
    screenshotPath: string;
  };

  platformFingerprint: {
    squareScriptTags: string[];
    squareApiCalls: string[];
    squareGlobals: string[];
    menuDataEndpoint?: string;
    csrfTokenPresent: boolean;
    sessionMechanism: string;
  };

  menuScrape: {
    success: boolean;
    isSSR: boolean;
    totalItems: number;
    categories: { name: string; itemCount: number }[];
    sampleItems: { name: string; price: string; hasImage: boolean }[];
    domStructure: {
      consistent: boolean;
      itemSelector?: string;
      priceSelector?: string;
      notes: string;
    };
    screenshotPath: string;
  };

  addToCart: {
    success: boolean;
    interactionSteps: string[];
    cartVerified: boolean;
    screenshotPath: string;
  };

  checkout: {
    reached: boolean;
    deliveryPickupSelector: boolean;
    deliveryAvailable: boolean;
    loginRequired: boolean;
    loginType?: string;
    guestCheckoutAvailable: boolean;
    paymentFormVisible: boolean;
    paymentFormType?: string;
    paymentIframeDomain?: string;
    squareCardElementPresent: boolean;
    paymentFormAutomatable: boolean;
    tipSelectionPresent: boolean;
    orderTotalVisible: boolean;
    estimatedTotal?: string;
    screenshotPath: string;
  };

  consistency: {
    runsCompleted: number;
    runsSuccessful: number;
    behaviorChanged: boolean;
    notes: string;
  };

  injectabilityScore: number;
  recommendation: "bot-ready" | "needs-investigation" | "human-ops-only";
  blockers: string[];
  advantages: string[];
};

const blockTextPatterns: RegExp[] = [
  /checking your browser/i,
  /attention required/i,
  /verify you are human/i,
  /access denied/i,
  /unusual traffic/i,
  /cloudflare/i,
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDomain(url: string) {
  return new URL(url).hostname;
}

function classifyBotBlockFromText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("cloudflare")) return "cloudflare_challenge";
  // Avoid classifying as captcha from incidental strings; rely on DOM signals instead.
  if (lower.includes("captcha")) return "unknown";
  if (lower.includes("verify you are human")) return "captcha";
  if (lower.includes("checking your browser")) return "cloudflare_challenge";
  if (lower.includes("attention required")) return "cloudflare_challenge";
  if (lower.includes("access denied")) return "waf_block";
  return "unknown";
}

async function detectBotBlock(page: Page) {
  const domSignal = await page
    .evaluate(() => {
      const iframeSrcs = Array.from(document.querySelectorAll("iframe"))
        .map((i) => i.getAttribute("src") ?? "")
        .filter(Boolean);

      if (iframeSrcs.some((s) => s.includes("challenges.cloudflare.com"))) return "cloudflare_challenge";
      if (iframeSrcs.some((s) => s.includes("hcaptcha.com") || s.includes("recaptcha") || s.includes("google.com/recaptcha"))) return "captcha";

      if (document.querySelector('input[name="cf-turnstile-response"]')) return "cloudflare_challenge";
      if (document.querySelector("#challenge-form")) return "cloudflare_challenge";
      if (document.querySelector(".cf-error-details")) return "cloudflare_challenge";

      if (document.querySelector(".h-captcha")) return "captcha";
      if (document.querySelector(".g-recaptcha")) return "captcha";
      // Some sites mount a captcha container without obvious iframe src.
      if (document.querySelector('[data-sitekey][class*="captcha" i]')) return "captcha";

      return null;
    })
    .catch(() => null);

  if (domSignal) return { blocked: true, type: domSignal };

  const title = (await page.title().catch(() => "")) ?? "";
  if (blockTextPatterns.some((re) => re.test(title))) {
    return { blocked: true, type: classifyBotBlockFromText(title) };
  }
  const bodyText = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
  if (blockTextPatterns.some((re) => re.test(bodyText))) {
    const classified = classifyBotBlockFromText(bodyText);
    // If we didn't see a real captcha/challenge DOM, treat as unknown and not blocked.
    if (classified === "unknown") return { blocked: false, type: "none" };
    return { blocked: true, type: classified };
  }
  return { blocked: false, type: "none" };
}

async function bestEffortDismissOverlays(page: Page, steps: string[]) {
  const patterns = [/accept/i, /agree/i, /got it/i, /continue/i, /^ok$/i] as const;
  for (const pattern of patterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2000 }).catch(() => undefined);
      steps.push(`Clicked overlay button (${pattern.toString()})`);
      await page.waitForTimeout(300);
    }
  }
}

async function waitForSquareRender(page: Page) {
  // Heuristics: menu item or any button that suggests ordering.
  await Promise.race([
    page
      .locator('button:has-text("Add to cart")')
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    page
      .locator('text=/\\$\\s?\\d+/')
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    page
      .locator('text=/enter\\s+delivery\\s+address/i')
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
  ]);
}

function looksLikeDeliveryGate(bodyText: string) {
  return /enter\s+delivery\s+address/i.test(bodyText);
}

async function looksLikeSquareLocationGate(page: Page) {
  const dialog = page.locator("div[role='dialog']").first();
  if (!(await dialog.isVisible().catch(() => false))) return false;

  const dialogText = await dialog.innerText().catch(() => "");
  if (/select\s+location/i.test(dialogText)) return true;
  if (/enter\s+delivery\s+address/i.test(dialogText)) return true;
  if (/start\s+order/i.test(dialogText) && /location/i.test(dialogText)) return true;
  return false;
}

function detectLoginWall(bodyText: string) {
  const lower = bodyText.toLowerCase();
  const loginRequired =
    lower.includes("sign in") &&
    (lower.includes("to continue") || lower.includes("required"));

  if (!loginRequired) return { loginRequired: false, loginType: "none" as const };

  if (lower.includes("phone") && lower.includes("code")) {
    return { loginRequired: true, loginType: "phone_otp" as const };
  }
  if (lower.includes("email") && lower.includes("password")) {
    return { loginRequired: true, loginType: "email_password" as const };
  }
  if (lower.includes("google") || lower.includes("facebook") || lower.includes("apple")) {
    return { loginRequired: true, loginType: "social" as const };
  }
  return { loginRequired: true, loginType: "unknown" as const };
}

function detectTipAndTotal(bodyText: string) {
  const tipSelectionPresent = /tip/i.test(bodyText) && (/\b10%\b/.test(bodyText) || /\b15%\b/.test(bodyText));
  const matchTotal = bodyText.match(/\btotal\b[^$]*\$\s?(\d+(?:\.\d{2})?)/i);
  const orderTotalVisible = Boolean(matchTotal);
  const estimatedTotal = matchTotal ? `$${matchTotal[1]}` : undefined;
  return { tipSelectionPresent, orderTotalVisible, estimatedTotal };
}

function detectPaymentForm(html: string) {
  const $ = cheerio.load(html);
  const iframeSrcs = $("iframe")
    .toArray()
    .map((el) => $(el).attr("src"))
    .filter((src): src is string => typeof src === "string");

  const iframeDomains = iframeSrcs
    .map((src) => {
      try {
        return new URL(src).hostname;
      } catch {
        return null;
      }
    })
    .filter((d): d is string => Boolean(d));

  const hasCardInputs =
    $('input[placeholder*="card" i]').length > 0 ||
    $('input[name*="card" i]').length > 0 ||
    html.toLowerCase().includes("card number");

  const squareCardElementPresent =
    $("#card-container").length > 0 ||
    html.toLowerCase().includes("web payments sdk") ||
    html.toLowerCase().includes("sq-card") ||
    html.toLowerCase().includes("squareup.com/payments");

  const looksLikeSquareSdk =
    iframeDomains.some((d) => d.includes("squareup.com")) ||
    html.toLowerCase().includes("web-payments-sdk") ||
    html.toLowerCase().includes("squareup.com/payments");

  const paymentFormVisible = hasCardInputs || looksLikeSquareSdk || /payment/i.test(html);

  let paymentFormType: string | undefined;
  let paymentIframeDomain: string | undefined;

  if (looksLikeSquareSdk) {
    paymentFormType = "square_web_payments_sdk";
    paymentIframeDomain = iframeDomains.find((d) => d.includes("squareup.com"));
  } else if (hasCardInputs) {
    paymentFormType = "standard_inputs";
  }

  // If payment is inside a cross-origin iframe, it is typically not automatable.
  const paymentFormAutomatable = paymentFormType === "standard_inputs";

  return {
    paymentFormVisible,
    paymentFormType,
    paymentIframeDomain,
    squareCardElementPresent,
    paymentFormAutomatable,
  };
}

async function analyzePaymentFrames(page: Page) {
  const frames = page.frames();
  const frameUrls = frames.map((f) => f.url()).filter(Boolean);

  const stripeFrame = frames.find((f) => /stripe\.com/i.test(f.url()));
  const squareFrame = frames.find((f) => /squareup\.com/i.test(f.url()) || /connect\.squareup\.com/i.test(f.url()));

  async function frameHasFillableInputs(frame: import("playwright").Frame) {
    const inputs = await frame.locator("input, [contenteditable='true']").count().catch(() => 0);
    // Some payment SDKs render inside shadow DOM; in that case inputs may not be visible.
    return inputs > 0;
  }

  if (stripeFrame) {
    const hasInputs = await frameHasFillableInputs(stripeFrame);
    return {
      paymentFormType: "stripe_iframe" as const,
      paymentIframeDomain: "stripe.com",
      paymentFormAutomatable: hasInputs,
      frameUrls,
    };
  }

  if (squareFrame) {
    const hasInputs = await frameHasFillableInputs(squareFrame);
    return {
      paymentFormType: "square_web_payments_sdk" as const,
      paymentIframeDomain: new URL(squareFrame.url()).hostname,
      paymentFormAutomatable: hasInputs,
      frameUrls,
    };
  }

  return {
    paymentFormType: undefined,
    paymentIframeDomain: undefined,
    paymentFormAutomatable: false,
    frameUrls,
  };
}

async function maybeSetDeliveryAddressToUnlockMenu(page: Page, steps: string[]) {
  // Many Square Online restaurant sites gate menus behind a delivery address modal.
  // We enter a known-valid address to enable ordering, but do not submit payment or place orders.
  const gate = page.locator('text=/enter\\s+delivery\\s+address/i').first();
  const gateVisible = await gate.isVisible().catch(() => false);

  const dialog = page.locator("div[role='dialog']").first();
  const scope = (await dialog.isVisible().catch(() => false)) ? dialog : page;
  const input = scope
    .locator(
      [
        'input[placeholder*="address" i]',
        'input[placeholder*="city" i]',
        'input[aria-label*="address" i]',
        'input[name*="address" i]',
        'input[type="search"]',
      ].join(", ")
    )
    .first();

  const inputVisible = await input.isVisible().catch(() => false);
  if (!gateVisible && !inputVisible) return false;

  steps.push("Delivery address gate detected (attempting to unlock menu)");

  await input.fill("2680 32nd St, Santa Monica, CA 90405").catch(() => undefined);
  await page.waitForTimeout(350);
  await input.press("Enter").catch(() => undefined);
  await page.waitForTimeout(650);

  // Pick a suggestion if one appears.
  const option =
    scope.getByRole("option").first() ??
    scope.locator('[role="option"]').first() ??
    scope.locator("li").first();
  if (await option.isVisible().catch(() => false)) {
    await option.click({ timeout: 4000 }).catch(() => undefined);
    steps.push("Selected first address suggestion");
    await page.waitForTimeout(800);
  }

  // If this is a "select location" gate, choose the first location.
  if (await dialog.isVisible().catch(() => false)) {
    const dialogText = await dialog.innerText().catch(() => "");
    if (/select\s+location/i.test(dialogText)) {
      const radio = dialog.locator('[role="radio"]').first();
      if (await radio.isVisible().catch(() => false)) {
        await radio.click({ timeout: 4000 }).catch(() => undefined);
        steps.push("Selected first location (role=radio)");
        await page.waitForTimeout(400);
      } else {
        const radioInput = dialog.locator('input[type="radio"]').first();
        if (await radioInput.isVisible().catch(() => false)) {
          await radioInput.click({ timeout: 4000 }).catch(() => undefined);
          steps.push("Selected first location (radio input)");
          await page.waitForTimeout(400);
        } else {
          const locationRow = dialog.locator("button, [role='button'], li").first();
          if (await locationRow.isVisible().catch(() => false)) {
            await locationRow.click({ timeout: 4000 }).catch(() => undefined);
            steps.push("Selected first location row (best-effort)");
            await page.waitForTimeout(400);
          }
        }
      }
    }
  }

  // Some sites require an explicit "Start order" click.
  const startOrder =
    (await clickFirstVisible(page, "button", /start order/i)) ||
    (await clickFirstVisible(page, "button", /see menu/i)) ||
    (await clickFirstVisible(page, "button", /continue/i));
  if (startOrder) {
    steps.push("Confirmed address gate CTA (Start order / See menu / Continue)");
    await page.waitForTimeout(900);
  }

  // If the modal is still present, prefer clicking a primary CTA (often the orange/red button).
  if (await dialog.isVisible().catch(() => false)) {
    const primary = dialog
      .locator("button:not([disabled])")
      .filter({ hasText: /start order|continue|see menu|confirm|save/i })
      .first();
    if (await primary.isVisible().catch(() => false)) {
      await primary.click({ timeout: 4000 }).catch(() => undefined);
      steps.push("Clicked modal primary CTA (text match)");
      await page.waitForTimeout(900);
    } else {
      const anyEnabled = dialog.locator("button:not([disabled])").first();
      if (await anyEnabled.isVisible().catch(() => false)) {
        await anyEnabled.click({ timeout: 4000 }).catch(() => undefined);
        steps.push("Clicked modal enabled button (fallback)");
        await page.waitForTimeout(900);
      }
    }
  }

  // Wait briefly for gate to disappear.
  await page
    .locator('text=/enter\\s+delivery\\s+address/i')
    .first()
    .waitFor({ state: "detached", timeout: 6000 })
    .catch(() => undefined);

  return true;
}

type SquareMenuApiExtraction = {
  items: Array<{ name: string; price: string; hasImage: boolean; categoryId?: string }>;
  categories: Array<{ name: string; itemCount: number }>;
};

async function fetchSquareMenuFromApi(options: {
  productsUrl: string;
  categoriesUrl?: string;
}): Promise<SquareMenuApiExtraction | null> {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "application/json",
  };

  const [productsRes, categoriesRes] = await Promise.all([
    fetch(options.productsUrl, { headers }).catch(() => null),
    options.categoriesUrl ? fetch(options.categoriesUrl, { headers }).catch(() => null) : Promise.resolve(null),
  ]);

  if (!productsRes || !productsRes.ok) return null;
  const productsJson = (await productsRes.json().catch(() => null)) as any;
  const products = (productsJson?.data ?? productsJson?.products ?? productsJson?.items) as any;
  if (!Array.isArray(products) || products.length === 0) return null;

  let categoryNameById = new Map<string, string>();
  if (categoriesRes && categoriesRes.ok) {
    const categoriesJson = (await categoriesRes.json().catch(() => null)) as any;
    const roots = (categoriesJson?.data ?? categoriesJson?.categories ?? []) as any[];
    const stack = Array.isArray(roots) ? [...roots] : [];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      const id = typeof node.id === "string" ? node.id : null;
      const name = typeof node.name === "string" ? node.name : null;
      if (id && name) categoryNameById.set(id, name);
      const children = node.children;
      if (Array.isArray(children)) {
        for (const c of children) stack.push(c);
      }
    }
  }

  const items: SquareMenuApiExtraction["items"] = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const name = typeof p.name === "string" ? p.name.trim() : null;
    const price = p.price?.low_formatted ?? p.price?.high_formatted ?? p.price?.lowFormatted ?? p.price?.highFormatted;
    const priceStr = typeof price === "string" ? price.trim() : null;
    if (!name || !priceStr) continue;
    const hasImage = Boolean(p.thumbnail || (Array.isArray(p.images) && p.images.length > 0));
    const categoryId = Array.isArray(p.categoryIds) && typeof p.categoryIds[0] === "string" ? p.categoryIds[0] : undefined;
    items.push({ name, price: priceStr, hasImage, categoryId });
  }

  const counts = new Map<string, number>();
  for (const it of items) {
    const key = it.categoryId && categoryNameById.get(it.categoryId) ? categoryNameById.get(it.categoryId)! : "Menu";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const categories = Array.from(counts.entries()).map(([name, itemCount]) => ({ name, itemCount }));

  return { items, categories };
}

async function scrapeMenuFromDom(page: Page) {
  const items = await page.evaluate(() => {
    const priceRegex = /\\$\\s?\\d+(?:\\.\\d{2})?/;

    // Square Online often uses button-like cards; start there.
    const buttons = Array.from(document.querySelectorAll("button"));
    const candidates = buttons
      .map((btn) => {
        const rawText = btn.textContent ?? "";
        const text = rawText.replace(/\\s+/g, " ").trim();
        if (!priceRegex.test(text)) return null;
        if (text.toLowerCase().includes("add to cart")) return null;
        const lines = text.split(" ").filter(Boolean);
        if (lines.length < 2) return null;

        const priceMatch = text.match(priceRegex);
        const price = priceMatch ? priceMatch[0].replace(/\\s+/g, "") : null;
        if (!price) return null;

        // Approximate name as text before the first price occurrence.
        const idx = text.indexOf(priceMatch ? priceMatch[0] : "");
        const name = idx > 0 ? text.slice(0, idx).replace(/\\s+/g, " ").trim() : text;
        if (name.length < 2 || name.length > 120) return null;

        const hasImage = Boolean(btn.querySelector("img"));
        return { name, price, hasImage };
      })
      .filter((v): v is { name: string; price: string; hasImage: boolean } => Boolean(v));

    // Deduplicate by (name, price).
    const seen = new Set<string>();
    const unique: Array<{ name: string; price: string; hasImage: boolean }> = [];
    for (const c of candidates) {
      const key = `${c.name}::${c.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    return unique.slice(0, 200);
  });

  return items;
}

async function clickFirstVisible(page: Page, role: "button" | "link", name: RegExp) {
  const loc = page.getByRole(role, { name }).first();
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click({ timeout: 4000 }).catch(() => undefined);
  return true;
}

async function addFirstItemToCart(page: Page, steps: string[], options?: { itemNameHint?: string }) {
  // Try a direct add button first.
  const addDirect = page.getByRole("button", { name: /add to cart/i }).first();
  if (await addDirect.isVisible().catch(() => false)) {
    await addDirect.click({ timeout: 5000 }).catch(() => undefined);
    steps.push('Clicked "Add to cart"');
    await page.waitForTimeout(800);
    return true;
  }

  // Otherwise click the first product-like button and then add.
  const hint = options?.itemNameHint?.trim();
  if (hint) {
    const re = new RegExp(escapeRegExp(hint), "i");
    const hinted = page
      .locator("button")
      .filter({ hasText: re })
      .first();
    if (await hinted.isVisible().catch(() => false)) {
      await hinted.click({ timeout: 5000 }).catch(() => undefined);
      steps.push(`Clicked hinted product button (${hint})`);
      await page.waitForTimeout(1000);
      const add = await clickFirstVisible(page, "button", /add to cart/i);
      if (add) {
        steps.push('Clicked "Add to cart" after opening hinted item');
        await page.waitForTimeout(800);
        return true;
      }
    }
  }

  const productBtn = page.locator('button:has-text("$")').first();
  if (await productBtn.isVisible().catch(() => false)) {
    await productBtn.click({ timeout: 5000 }).catch(() => undefined);
    steps.push("Clicked first product-like button (contains $)");
    await page.waitForTimeout(1000);
    const add = await clickFirstVisible(page, "button", /add to cart/i);
    if (add) {
      steps.push('Clicked "Add to cart" after opening item');
      await page.waitForTimeout(800);
      return true;
    }
  }

  return false;
}

async function verifyCart(page: Page) {
  // Cart may always be visible; prefer checking a badge/count first.
  const badge = page.locator('[aria-label*="cart" i] [data-testid*="badge" i], [data-testid*="cart" i] [data-testid*="badge" i], [class*="badge" i]').first();
  const badgeText = await badge.innerText().catch(() => "");
  if (/\b[1-9]\d*\b/.test(badgeText)) return true;

  const cart = page.getByRole("button", { name: /cart/i }).first();
  if (await cart.isVisible().catch(() => false)) return true;
  const checkout = page.getByRole("button", { name: /checkout/i }).first();
  if (await checkout.isVisible().catch(() => false)) return true;
  return false;
}

async function reachCheckout(page: Page, steps: string[]) {
  const patterns = [/checkout/i, /view cart/i, /^cart$/i];
  for (const pattern of patterns) {
    const clicked = await clickFirstVisible(page, "button", pattern);
    if (clicked) {
      steps.push(`Clicked navigation button (${pattern.toString()})`);
      await page.waitForTimeout(1200);
      return true;
    }
  }
  const link = page.locator('a[href*="checkout"]').first();
  if (await link.isVisible().catch(() => false)) {
    await link.click({ timeout: 4000 }).catch(() => undefined);
    steps.push('Clicked checkout link (href contains "checkout")');
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

async function fillDeliveryAddressIfPresent(page: Page, steps: string[]) {
  const input = page
    .locator('input[placeholder*="address" i], input[name*="address" i]')
    .first();
  if (!(await input.isVisible().catch(() => false))) {
    return { deliveryPickupSelector: false, deliveryAvailable: false };
  }

  steps.push("Delivery address form detected");
  await input.fill("2680 32nd St, Santa Monica, CA 90405").catch(() => undefined);
  await page.waitForTimeout(500);
  await input.press("Enter").catch(() => undefined);
  await page.waitForTimeout(800);

  const option = page.getByRole("option").first();
  if (await option.isVisible().catch(() => false)) {
    await option.click({ timeout: 4000 }).catch(() => undefined);
    steps.push("Selected first address suggestion");
    await page.waitForTimeout(1200);
  }

  const bodyText = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
  const blockedByArea =
    /outside.*delivery area/i.test(bodyText) ||
    /not.*deliver/i.test(bodyText) ||
    /delivery.*unavailable/i.test(bodyText);

  return { deliveryPickupSelector: true, deliveryAvailable: !blockedByArea };
}

function pickBestProductsUrl(urls: string[]) {
  const candidates = urls.filter((u) => u.includes("/products"));
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((u) => {
      let perPage = 0;
      try {
        const parsed = new URL(u);
        const raw = parsed.searchParams.get("per_page");
        const n = raw ? Number(raw) : 0;
        perPage = Number.isFinite(n) ? n : 0;
      } catch {
        perPage = 0;
      }
      const includesImages = /include=.*\bimages\b/i.test(u);
      return { u, perPage, includesImages };
    })
    .sort((a, b) => {
      if (a.perPage !== b.perPage) return b.perPage - a.perPage;
      if (a.includesImages !== b.includesImages) return a.includesImages ? -1 : 1;
      return b.u.length - a.u.length;
    });

  return scored[0]?.u ?? null;
}

export async function probeSquareOnlineOnce(options: {
  url: string;
  runIndex: number;
  screenshotDir: string;
  networkLog: Array<{ url: string; method: string; resourceType: string; status?: number }>;
}) {
  const start = Date.now();
  const domain = toDomain(options.url);
  const slug = `${safeSlug(domain)}-run-${options.runIndex}`;

  const screenshotPath = (name: string) =>
    path.join(options.screenshotDir, `${slug}-${name}.png`);

  const browser = await chromium.launch({ headless: true });
  const steps: string[] = [];

  let navResponse: Response | null = null;
  const apiCalls = new Set<string>();
  const jsonApiCandidates: string[] = [];
  const scriptTags = new Set<string>();
  const productsApiEndpoints = new Set<string>();
  const categoriesApiEndpoints = new Set<string>();

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    page.on("requestfinished", async (req) => {
      const resourceType = req.resourceType();
      let status: number | undefined;
      try {
        const resp = await req.response();
        status = resp?.status();
      } catch {
        status = undefined;
      }
      options.networkLog.push({
        url: req.url(),
        method: req.method(),
        resourceType,
        status,
      });

      if (resourceType === "xhr" || resourceType === "fetch") {
        apiCalls.add(req.url());
        if (req.url().includes("/app/store/api/") && req.url().includes("/products")) {
          productsApiEndpoints.add(req.url());
        }
        if (req.url().includes("/app/store/api/") && req.url().includes("/categories")) {
          categoriesApiEndpoints.add(req.url());
        }
      }
    });

    page.on("response", async (resp) => {
      const req = resp.request();
      if (req.resourceType() !== "xhr" && req.resourceType() !== "fetch") return;
      const headers = (await resp
        .allHeaders()
        .catch(() => ({} as Record<string, string>))) as Record<string, string>;
      const contentType = headers["content-type"] ?? headers["Content-Type"] ?? "";
      if (!String(contentType).includes("application/json")) return;

      const url = resp.url();
      // Best-effort: look for a menu-like payload, without storing bodies.
      const text = await resp.text().catch(() => "");
      const lower = text.toLowerCase();
      if (lower.includes("item") && lower.includes("price") && lower.includes("{")) {
        jsonApiCandidates.push(url);
      }
    });

    const t0 = Date.now();
    navResponse = await page.goto(options.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await waitForSquareRender(page);
    const loadTimeMs = Date.now() - t0;

    await delay(1500);
    await bestEffortDismissOverlays(page, steps);
    await maybeSetDeliveryAddressToUnlockMenu(page, steps);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await waitForSquareRender(page);

    // If we still have the delivery/location gate visible, treat it as "not yet unlocked"
    // rather than bot detection.
    const gateStillVisible = await looksLikeSquareLocationGate(page);
    const block = gateStillVisible ? { blocked: false, type: "none" as const } : await detectBotBlock(page);

    const initialShot = screenshotPath("initial");
    await page.screenshot({ path: initialShot, fullPage: true });

    const wafHeaders = pickWafHeaders((await navResponse?.allHeaders().catch(() => ({}))) ?? {});

    // Fingerprint scripts after render.
    const scripts = await page
      .evaluate(() => Array.from(document.querySelectorAll("script[src]")).map((s) => (s as HTMLScriptElement).src))
      .catch(() => []);
    for (const src of scripts) {
      if (!src) continue;
      if (src.includes("square") || src.includes("squareup") || src.includes("editmysite")) {
        scriptTags.add(src);
      }
    }

    const globals: string[] = [];
    const squareGlobalPresent = await page
      .evaluate(() => {
        const out: string[] = [];
        const w = window as unknown as Record<string, unknown>;
        if (typeof w["Square"] !== "undefined") out.push("window.Square");
        if (typeof w["square"] !== "undefined") out.push("window.square");
        if (typeof w["SqPaymentForm"] !== "undefined") out.push("window.SqPaymentForm");
        return out;
      })
      .catch(() => []);
    globals.push(...squareGlobalPresent);

    const htmlAfter = await page.content();
    const csrfTokenPresent =
      htmlAfter.toLowerCase().includes("csrf") ||
      /name=["']csrf/i.test(htmlAfter) ||
      /csrfToken/i.test(htmlAfter);

    const sessionMechanism = await page
      .evaluate(() => {
        const hasCookie = document.cookie.length > 0;
        let hasLocalStorage = false;
        try {
          hasLocalStorage = localStorage.length > 0;
        } catch {
          hasLocalStorage = false;
        }
        if (hasCookie && hasLocalStorage) return "cookie+localStorage";
        if (hasCookie) return "cookie";
        if (hasLocalStorage) return "localStorage";
        return "none observed";
      })
      .catch(() => "unknown");

    // Menu scrape from DOM.
    const menuShot = screenshotPath("menu");
    await page.screenshot({ path: menuShot, fullPage: true });

    const productsUrl =
      pickBestProductsUrl(Array.from(productsApiEndpoints)) ??
      pickBestProductsUrl(jsonApiCandidates) ??
      jsonApiCandidates.find((u) => u.includes("/products")) ??
      jsonApiCandidates[0] ??
      null;
    const categoriesUrl = Array.from(categoriesApiEndpoints)[0] ?? jsonApiCandidates.find((u) => u.includes("/categories"));

    const apiMenu = productsUrl ? await fetchSquareMenuFromApi({ productsUrl, categoriesUrl }) : null;
    const domItems = apiMenu ? [] : await scrapeMenuFromDom(page);

    const totalItems = apiMenu ? apiMenu.items.length : domItems.length;
    const sampleItems = apiMenu ? apiMenu.items.slice(0, 5) : domItems.slice(0, 5);
    const categories = apiMenu
      ? apiMenu.categories
      : totalItems > 0
        ? [{ name: "Menu", itemCount: totalItems }]
        : [];

    const domStructure = {
      consistent: totalItems >= 5,
      itemSelector: apiMenu ? "Square Store API (/products)" : 'button:has-text("$")',
      priceSelector: apiMenu ? "price.low_formatted/high_formatted" : 'text=/\\$\\s?\\d+/',
      notes:
        apiMenu
          ? "Extracted menu via Square Online Store API calls observed during load."
          : totalItems > 0
            ? "Heuristic scrape: extracted items from button text containing prices."
            : "No obvious price-bearing buttons detected; Square site may require deeper, platform-specific selectors.",
    };

    // Add to cart.
    const addShot = screenshotPath("add-to-cart");
    const addOk = block.blocked
      ? false
      : await addFirstItemToCart(page, steps, { itemNameHint: sampleItems[0]?.name });
    await delay(1200);
    const cartVerified = addOk ? await verifyCart(page) : false;
    await page.screenshot({ path: addShot, fullPage: true });

    // Checkout.
    const checkoutShot = screenshotPath("checkout");
    const reachedCheckout = addOk ? await reachCheckout(page, steps) : false;
    await delay(1500);

    const { deliveryPickupSelector, deliveryAvailable } = reachedCheckout
      ? await fillDeliveryAddressIfPresent(page, steps)
      : { deliveryPickupSelector: false, deliveryAvailable: false };

    await delay(1500);
    const checkoutHtml = await page.content();
    const checkoutText = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
    const login = detectLoginWall(checkoutText);
    const payment = detectPaymentForm(checkoutHtml);
    const framePayment = await analyzePaymentFrames(page);
    const tipTotal = detectTipAndTotal(checkoutText);

    // Guest checkout heuristic: if we can see contact fields without explicit login requirement.
    const guestCheckoutAvailable =
      !login.loginRequired &&
      (/email/i.test(checkoutText) || /phone/i.test(checkoutText) || /contact/i.test(checkoutText));

    await page.screenshot({ path: checkoutShot, fullPage: true });

    const pageLoad = {
      success: Boolean(navResponse) && navResponse?.ok() === true && !block.blocked,
      loadTimeMs,
      jsRenderRequired: true,
      botDetectionEncountered: block.blocked,
      botDetectionType: block.blocked ? block.type : "none",
      wafHeaders,
      screenshotPath: path.relative(process.cwd(), initialShot),
    };

    const platformFingerprint = {
      squareScriptTags: Array.from(scriptTags),
      squareApiCalls: Array.from(apiCalls),
      squareGlobals: globals,
      menuDataEndpoint: productsUrl,
      csrfTokenPresent,
      sessionMechanism,
    };

    const menuScrape = {
      success: totalItems > 0,
      isSSR: false,
      totalItems,
      categories,
      sampleItems,
      domStructure,
      screenshotPath: path.relative(process.cwd(), menuShot),
    };

    const addToCart = {
      success: addOk,
      interactionSteps: steps.slice(),
      cartVerified,
      screenshotPath: path.relative(process.cwd(), addShot),
    };

    const checkout = {
      reached: reachedCheckout,
      deliveryPickupSelector,
      deliveryAvailable,
      loginRequired: login.loginRequired,
      loginType: login.loginType === "none" ? undefined : login.loginType,
      guestCheckoutAvailable,
      paymentFormVisible: payment.paymentFormVisible,
      paymentFormType: framePayment.paymentFormType ?? payment.paymentFormType,
      paymentIframeDomain: framePayment.paymentIframeDomain ?? payment.paymentIframeDomain,
      squareCardElementPresent: payment.squareCardElementPresent,
      paymentFormAutomatable:
        framePayment.paymentFormAutomatable || payment.paymentFormAutomatable,
      tipSelectionPresent: tipTotal.tipSelectionPresent,
      orderTotalVisible: tipTotal.orderTotalVisible,
      estimatedTotal: tipTotal.estimatedTotal,
      screenshotPath: path.relative(process.cwd(), checkoutShot),
    };

    return {
      ok: true as const,
      run: {
        target: { url: options.url, domain, platform: "square_online" as const },
        pageLoad,
        platformFingerprint,
        menuScrape,
        addToCart,
        checkout,
        meta: { startedAt: nowIso(), durationMs: Date.now() - start },
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      errorMessage: error instanceof Error ? error.message : "Probe failed",
      run: null,
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function scoreSquareResult(result: SquareOnlineProbeResult) {
  let score = 0;

  if (result.pageLoad.success && !result.pageLoad.botDetectionEncountered) score += 15;
  if (result.menuScrape.success) score += 10;
  if (result.menuScrape.domStructure.consistent) score += 5;
  if (result.platformFingerprint.menuDataEndpoint) score += 5;
  if (result.addToCart.success && result.addToCart.cartVerified) score += 15;
  if (!result.checkout.loginRequired && result.checkout.reached) score += 20;
  if (result.checkout.paymentFormVisible && result.checkout.paymentFormAutomatable) score += 15;
  if (result.checkout.deliveryAvailable || !result.checkout.deliveryPickupSelector) score += 5;
  if (result.consistency.runsSuccessful === 3 && !result.consistency.behaviorChanged) score += 10;

  return Math.max(0, Math.min(100, score));
}

function toRecommendation(score: number): SquareOnlineProbeResult["recommendation"] {
  if (score >= 75) return "bot-ready";
  if (score >= 50) return "needs-investigation";
  return "human-ops-only";
}

function buildBlockersAndAdvantages(result: SquareOnlineProbeResult) {
  const blockers: string[] = [];
  const advantages: string[] = [];

  if (result.pageLoad.botDetectionEncountered) {
    blockers.push(`Bot detection encountered: ${result.pageLoad.botDetectionType ?? "unknown"}`);
  } else {
    advantages.push("No bot challenge observed on page load");
  }

  if (result.platformFingerprint.menuDataEndpoint) {
    advantages.push("Potential JSON menu endpoint observed during load");
  }

  if (result.menuScrape.success) {
    advantages.push("Menu items appear scrapeable from rendered DOM");
  } else {
    blockers.push("Failed to scrape menu items from DOM (may need Square-specific selectors)");
  }

  if (result.addToCart.success && result.addToCart.cartVerified) {
    advantages.push("Add-to-cart is automatable (best effort)");
  } else {
    blockers.push("Could not reliably add an item to cart");
  }

  if (result.checkout.loginRequired) {
    blockers.push("Login appears required to reach payment");
  } else if (result.checkout.reached) {
    advantages.push("Checkout reachable without explicit login wall");
  }

  if (!result.checkout.paymentFormVisible) {
    blockers.push("Payment form not detected");
  } else if (result.checkout.paymentFormType === "square_web_payments_sdk") {
    blockers.push("Square Web Payments SDK likely uses secure iframes (often not automatable)");
  } else if (result.checkout.paymentFormAutomatable) {
    advantages.push("Payment form appears automatable (standard inputs)");
  } else {
    blockers.push("Payment form does not appear automatable");
  }

  if (result.checkout.deliveryPickupSelector && !result.checkout.deliveryAvailable) {
    blockers.push("Delivery not available to the test hotel address (or delivery not offered)");
  } else if (result.checkout.deliveryAvailable) {
    advantages.push("Delivery appears available for the test hotel address");
  }

  return { blockers, advantages };
}

export async function runSquareOnlineProbe(options: {
  url: string;
  runs: number;
  screenshotDir: string;
  networkLogPath: string;
}) {
  const domain = toDomain(options.url);

  const networkLog: Array<{ url: string; method: string; resourceType: string; status?: number }> = [];

  const runResults: Array<{ pageLoadOk: boolean; botBlocked: boolean }> = [];
  let successfulRuns = 0;
  let sawBotBlockAfterSuccess = false;

  let best: SquareOnlineProbeResult | null = null;

  for (let i = 1; i <= options.runs; i += 1) {
    const run = await probeSquareOnlineOnce({
      url: options.url,
      runIndex: i,
      screenshotDir: options.screenshotDir,
      networkLog,
    });

    if (!run.ok || !run.run) {
      runResults.push({ pageLoadOk: false, botBlocked: false });
      await delay(30_000);
      continue;
    }

    const pageLoadOk = run.run.pageLoad.success;
    const botBlocked = run.run.pageLoad.botDetectionEncountered;
    if (pageLoadOk && !botBlocked) successfulRuns += 1;
    if (successfulRuns > 0 && botBlocked) sawBotBlockAfterSuccess = true;

    runResults.push({ pageLoadOk, botBlocked });

    if (!best) {
      best = {
        ...run.run,
        consistency: {
          runsCompleted: options.runs,
          runsSuccessful: successfulRuns,
          behaviorChanged: sawBotBlockAfterSuccess,
          notes: "",
        },
        injectabilityScore: 0,
        recommendation: "human-ops-only",
        blockers: [],
        advantages: [],
      };
    } else {
      const bestRank =
        (best.checkout.reached ? 2 : 0) + (best.addToCart.cartVerified ? 1 : 0);
      const candidateRank =
        (run.run.checkout.reached ? 2 : 0) + (run.run.addToCart.cartVerified ? 1 : 0);
      if (candidateRank > bestRank) {
        best = {
          ...run.run,
          consistency: best.consistency,
          injectabilityScore: 0,
          recommendation: "human-ops-only",
          blockers: [],
          advantages: [],
        };
      }
    }

    await delay(30_000);
  }

  // Save network log for inspection.
  await writeJson(options.networkLogPath, {
    generatedAt: nowIso(),
    target: options.url,
    entries: networkLog,
  });

  if (!best) {
    const screenshot = path.join(options.screenshotDir, `${safeSlug(domain)}-initial.png`);
    best = {
      target: { url: options.url, domain, platform: "square_online" },
      pageLoad: {
        success: false,
        loadTimeMs: 0,
        jsRenderRequired: true,
        botDetectionEncountered: false,
        botDetectionType: "none",
        wafHeaders: {},
        screenshotPath: path.relative(process.cwd(), screenshot),
      },
      platformFingerprint: {
        squareScriptTags: [],
        squareApiCalls: [],
        squareGlobals: [],
        csrfTokenPresent: false,
        sessionMechanism: "unknown",
      },
      menuScrape: {
        success: false,
        isSSR: false,
        totalItems: 0,
        categories: [],
        sampleItems: [],
        domStructure: { consistent: false, notes: "Probe failed" },
        screenshotPath: path.relative(process.cwd(), screenshot),
      },
      addToCart: {
        success: false,
        interactionSteps: [],
        cartVerified: false,
        screenshotPath: path.relative(process.cwd(), screenshot),
      },
      checkout: {
        reached: false,
        deliveryPickupSelector: false,
        deliveryAvailable: false,
        loginRequired: false,
        guestCheckoutAvailable: false,
        paymentFormVisible: false,
        squareCardElementPresent: false,
        paymentFormAutomatable: false,
        tipSelectionPresent: false,
        orderTotalVisible: false,
        screenshotPath: path.relative(process.cwd(), screenshot),
      },
      consistency: {
        runsCompleted: options.runs,
        runsSuccessful: 0,
        behaviorChanged: false,
        notes: "All runs failed to complete",
      },
      injectabilityScore: 0,
      recommendation: "human-ops-only",
      blockers: ["Probe failed to complete"],
      advantages: [],
    };
  }

  best.consistency = {
    runsCompleted: options.runs,
    runsSuccessful: successfulRuns,
    behaviorChanged: sawBotBlockAfterSuccess,
    notes: runResults
      .map((r, idx) => {
        const i = idx + 1;
        if (!r.pageLoadOk) return `run ${i}: page load failed`;
        if (r.botBlocked) return `run ${i}: bot block detected`;
        return `run ${i}: ok`;
      })
      .join(" | "),
  };

  best.injectabilityScore = scoreSquareResult(best);
  best.recommendation = toRecommendation(best.injectabilityScore);
  const analysis = buildBlockersAndAdvantages(best);
  best.blockers = analysis.blockers;
  best.advantages = analysis.advantages;

  return best;
}
