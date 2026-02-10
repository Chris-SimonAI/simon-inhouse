import * as cheerio from "cheerio";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { delay, nowIso, pickWafHeaders, safeSlug } from "./probe-utils";

export type SliceProbeResult = {
  target: {
    url: string;
    domain: string;
    isWhiteLabel: boolean;
  };

  pageLoad: {
    success: boolean;
    loadTimeMs: number;
    botDetectionEncountered: boolean;
    botDetectionType?: string;
    wafHeaders: Record<string, string>;
    screenshotPath: string;
  };

  menuScrape: {
    success: boolean;
    isSSR: boolean;
    totalItems: number;
    categories: { name: string; itemCount: number }[];
    sampleItems: { name: string; price: string; hasImage: boolean }[];
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
    loginRequired: boolean;
    loginType?: string;
    deliveryAddressForm: boolean;
    deliveryAvailable: boolean;
    paymentFormVisible: boolean;
    paymentFormType?: string;
    paymentIframeDomain?: string;
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

type SliceMenuExtraction = {
  categories: Array<{ name: string; products: Array<{ name: string; price: string; image?: string }> }>;
};

const blockTextPatterns: RegExp[] = [
  /checking your browser/i,
  /attention required/i,
  /verify you are human/i,
  /access denied/i,
  /unusual traffic/i,
  /cloudflare/i,
];

function toDomain(url: string) {
  return new URL(url).hostname;
}

function classifyBotBlockFromText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("cloudflare")) return "cloudflare_challenge";
  if (lower.includes("captcha")) return "captcha";
  if (lower.includes("verify you are human")) return "captcha";
  if (lower.includes("checking your browser")) return "cloudflare_challenge";
  if (lower.includes("attention required")) return "cloudflare_challenge";
  if (lower.includes("access denied")) return "waf_block";
  return "unknown";
}

function extractInitialDataContextJson(html: string) {
  const marker = "window._initialDataContext =";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const startIdx = html.indexOf("{", idx);
  if (startIdx === -1) return null;

  // Brace matching so we don't rely on regex over huge payloads.
  let depth = 0;
  for (let i = startIdx; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      const jsonText = html.slice(startIdx, i + 1);
      try {
        return JSON.parse(jsonText) as unknown;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function findSliceMenuPayload(value: unknown): SliceMenuExtraction | null {
  if (!value || typeof value !== "object") return null;

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") {
      continue;
    }

    const record = current as Record<string, unknown>;
    const categories = record["categories"];
    if (Array.isArray(categories) && categories.length > 0) {
      const normalized: SliceMenuExtraction["categories"] = [];

      for (const entry of categories) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const name = typeof e["name"] === "string" ? e["name"] : null;
        const hidden = typeof e["hidden"] === "boolean" ? e["hidden"] : false;
        const products = e["products"];
        if (!name || hidden) continue;
        if (!Array.isArray(products) || products.length === 0) continue;

        const normalizedProducts: Array<{ name: string; price: string; image?: string }> = [];
        for (const p of products) {
          if (!p || typeof p !== "object") continue;
          const pr = p as Record<string, unknown>;
          const productName = typeof pr["name"] === "string" ? pr["name"] : null;
          const price = typeof pr["price"] === "string" ? pr["price"] : null;
          const image = typeof pr["image"] === "string" ? pr["image"] : undefined;
          if (!productName || !price) continue;
          normalizedProducts.push({ name: productName, price, image });
        }

        if (normalizedProducts.length === 0) continue;
        normalized.push({ name, products: normalizedProducts });
      }

      const total = normalized.reduce((sum, c) => sum + c.products.length, 0);
      if (normalized.length >= 2 && total >= 10) return { categories: normalized };
    }

    for (const next of Object.values(record)) {
      if (next && typeof next === "object") {
        stack.push(next);
      }
    }
  }

  return null;
}

function extractSliceReduxStateJson(html: string) {
  const marker = "window.__SLICE_REDUX_STATE__=";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const startIdx = html.indexOf("{", idx);
  if (startIdx === -1) return null;

  let depth = 0;
  for (let i = startIdx; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      const jsonText = html.slice(startIdx, i + 1);
      try {
        return JSON.parse(jsonText) as unknown;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function findSliceMenuFromReduxState(value: unknown): SliceMenuExtraction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const menus = record["menus"];
  if (!menus || typeof menus !== "object") return null;
  const menusRecord = menus as Record<string, unknown>;
  const menusByKey = menusRecord["menus"];
  if (!menusByKey || typeof menusByKey !== "object") return null;

  const byKey = menusByKey as Record<string, unknown>;
  const normalized: SliceMenuExtraction["categories"] = [];

  for (const menuEntry of Object.values(byKey)) {
    if (!menuEntry || typeof menuEntry !== "object") continue;
    const me = menuEntry as Record<string, unknown>;
    const valueNode = me["value"];
    if (!valueNode || typeof valueNode !== "object") continue;
    const v = valueNode as Record<string, unknown>;
    const categories = v["categories"];
    if (!Array.isArray(categories) || categories.length === 0) continue;

    for (const entry of categories) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const name = typeof e["name"] === "string" ? e["name"] : null;
      const isDisplayed = typeof e["isDisplayed"] === "boolean" ? e["isDisplayed"] : true;
      const products = e["groupedProducts"];
      if (!name || !isDisplayed) continue;
      if (!Array.isArray(products) || products.length === 0) continue;

      const normalizedProducts: Array<{ name: string; price: string; image?: string }> = [];
      for (const p of products) {
        if (!p || typeof p !== "object") continue;
        const pr = p as Record<string, unknown>;
        const productName = typeof pr["name"] === "string" ? pr["name"] : null;
        const basePrice = typeof pr["basePrice"] === "string" ? pr["basePrice"] : null;
        const image = typeof pr["image"] === "string" ? pr["image"] : undefined;
        if (!productName || !basePrice) continue;
        normalizedProducts.push({ name: productName, price: `$${basePrice}`, image });
      }

      if (normalizedProducts.length === 0) continue;
      normalized.push({ name, products: normalizedProducts });
    }
  }

  const total = normalized.reduce((sum, c) => sum + c.products.length, 0);
  if (normalized.length >= 2 && total >= 10) return { categories: normalized };
  return null;
}

async function extractMenuFromHttp(url: string) {
  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html",
      },
    });
    html = await res.text();
  } catch {
    return { ok: false, html: "", menu: null };
  }
  const context = extractInitialDataContextJson(html);
  const redux = extractSliceReduxStateJson(html);
  const menu = context
    ? findSliceMenuPayload(context)
    : redux
      ? findSliceMenuFromReduxState(redux)
      : null;
  return { ok: Boolean(menu), html, menu };
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

async function detectBotBlock(page: Page) {
  // Prefer DOM signals over keyword matches to avoid false positives.
  const domSignal = await page
    .evaluate(() => {
      const iframeSrcs = Array.from(document.querySelectorAll("iframe"))
        .map((i) => i.getAttribute("src") ?? "")
        .filter(Boolean);

      if (iframeSrcs.some((s) => s.includes("challenges.cloudflare.com"))) return "cloudflare_challenge";
      if (iframeSrcs.some((s) => s.includes("hcaptcha.com") || s.includes("recaptcha"))) return "captcha";

      if (document.querySelector('input[name="cf-turnstile-response"]')) return "cloudflare_challenge";
      if (document.querySelector("#challenge-form")) return "cloudflare_challenge";
      if (document.querySelector(".cf-error-details")) return "cloudflare_challenge";

      if (document.querySelector(".h-captcha")) return "captcha";
      if (document.querySelector(".g-recaptcha")) return "captcha";

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
    return { blocked: true, type: classifyBotBlockFromText(bodyText) };
  }
  return { blocked: false, type: "none" };
}

async function waitForSliceRender(page: Page) {
  await Promise.race([
    page
      .locator('text=/\\$\\s?\\d+(?:\\.\\d{2})?/')
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
    page
      .getByRole("button", { name: /add/i })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined),
  ]);
}

async function clickFirstVisible(page: Page, role: "button" | "link", name: RegExp) {
  const loc = page.getByRole(role, { name }).first();
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click({ timeout: 4000 }).catch(() => undefined);
  return true;
}

async function scrapeSliceMenuFromDom(page: Page) {
  const extracted = await page.evaluate(() => {
    const priceRe = /\\$\\s?\\d+(?:\\.\\d{2})?/;

    // Central Slice tends to split name/price across different elements.
    // Anchor on the price elements, then extract name + image from the surrounding card container.
    const all = Array.from(document.querySelectorAll("*"));
    const rawCandidates: Array<{ name: string; price: string; hasImage: boolean; category?: string }> = [];

    for (let i = 0; i < all.length && rawCandidates.length < 700; i += 1) {
      const node = all[i];
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const rawText = (node as HTMLElement).innerText ?? "";
      const compact = rawText.replace(/\\s+/g, " ").trim();
      if (!compact) continue;
      if (compact.length > 18) continue;
      if (!priceRe.test(compact)) continue;
      if (!compact.trim().startsWith("$")) continue;

      const priceMatch = compact.match(priceRe);
      const price = priceMatch ? priceMatch[0].replace(/\\s+/g, "") : null;
      if (!price) continue;

      // Walk up to a card-like container that includes more context.
      let container: Element | null = node;
      let best: { el: Element; text: string } | null = null;
      for (let hops = 0; hops < 10; hops += 1) {
        container = container?.parentElement ?? null;
        if (!container) break;

        const r = container.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;

        const t = (container as HTMLElement).innerText ?? "";
        const compactT = t.replace(/\\s+/g, " ").trim();
        if (!compactT) continue;
        if (compactT.length < 12 || compactT.length > 900) continue;
        if (!compactT.includes(price)) continue;

        best = { el: container, text: t };
        break;
      }

      if (!best) continue;

      const card = best.el;
      const cardText = best.text;

      let name = "";
      const heading = card.querySelector("h3, h2, [role='heading']");
      if (heading) {
        const hr = heading.getBoundingClientRect();
        if (hr.width > 0 && hr.height > 0) {
          name = (heading.textContent ?? "").replace(/\\s+/g, " ").trim();
        }
      }

      if (!name) {
        const lines = cardText
          .split(/\\n|\\r/)
          .map((l) => l.replace(/\\s+/g, " ").trim())
          .filter(Boolean);

        for (let li = 0; li < lines.length; li += 1) {
          const line = lines[li];
          const lower = line.toLowerCase();
          if (lower === price.toLowerCase()) continue;
          if (lower.includes("add") || lower.includes("customize") || lower.includes("choose") || lower.includes("select")) {
            continue;
          }
          if (priceRe.test(line)) continue;
          if (line.length < 2 || line.length > 120) continue;
          name = line;
          break;
        }
      }

      if (!name) continue;

      let category: string | undefined = undefined;
      let cur: Element | null = card;
      for (let hops = 0; hops < 22 && cur && !category; hops += 1) {
        let prev: Element | null = cur.previousElementSibling;
        while (prev && !category) {
          const tag = prev.tagName.toLowerCase();
          if (tag === "h2" || tag === "h3") {
            const r = prev.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const t = (prev.textContent ?? "").replace(/\\s+/g, " ").trim();
              if (t.length >= 2 && t.length <= 60) category = t;
            }
          }
          prev = prev.previousElementSibling;
        }
        cur = cur.parentElement;
      }

      const hasImage = Boolean(card.querySelector("img"));
      rawCandidates.push({ name, price, hasImage, category });
    }

    const seen = new Set<string>();
    const items: Array<{ name: string; price: string; hasImage: boolean; category?: string }> = [];
    for (const c of rawCandidates) {
      const key = `${c.name}::${c.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(c);
    }

    const byCategory = new Map<string, Array<{ name: string; price: string; hasImage: boolean }>>();
    for (const it of items) {
      const cat = it.category ?? "Menu";
      const bucket = byCategory.get(cat) ?? [];
      bucket.push({ name: it.name, price: it.price, hasImage: it.hasImage });
      byCategory.set(cat, bucket);
    }

    const categories = Array.from(byCategory.entries()).map(([name, list]) => ({
      name,
      itemCount: list.length,
    }));

    return {
      items: items.map((i) => ({ name: i.name, price: i.price, hasImage: i.hasImage })),
      categories,
    };
  });

  return extracted;
}

async function addFirstItemToCart(page: Page, steps: string[], options?: { itemNameHint?: string }) {
  const addPatterns = [/add to cart/i, /add to order/i, /^add$/i];

  // Prefer accessible-name matching so icon buttons (aria-label="Add") work.
  const simpleAdd = page.getByRole("button", { name: /^add$/i }).first();
  if (await simpleAdd.isVisible().catch(() => false)) {
    await simpleAdd.click({ timeout: 5000 }).catch(() => undefined);
    steps.push('Clicked "Add"');
    await page.waitForTimeout(800);
    const confirmed =
      (await clickFirstVisible(page, "button", /add to cart/i)) ||
      (await clickFirstVisible(page, "button", /add to order/i));
    if (confirmed) {
      steps.push("Confirmed add in item editor");
      await page.waitForTimeout(800);
    }
    return true;
  }

  for (const pattern of addPatterns) {
    const btn = page.getByRole("button", { name: pattern }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 5000 }).catch(() => undefined);
      steps.push(`Clicked add button (${pattern.toString()})`);
      await page.waitForTimeout(800);

      // If a modal opens, confirm add if needed.
      const confirmed =
        (await clickFirstVisible(page, "button", /add to cart/i)) ||
        (await clickFirstVisible(page, "button", /add to order/i));
      if (confirmed) {
        steps.push("Confirmed add in item editor");
        await page.waitForTimeout(800);
      }
      return true;
    }
  }

  // Fallback: click first product card then try add.
  const productButtons = page.locator('button:has-text("$")').first();
  if (await productButtons.isVisible().catch(() => false)) {
    await productButtons.click({ timeout: 5000 }).catch(() => undefined);
    steps.push("Clicked first product-like button (contains $)");
    await page.waitForTimeout(800);
    for (const pattern of addPatterns) {
      const btn = page.getByRole("button", { name: pattern }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 5000 }).catch(() => undefined);
        steps.push(`Clicked add button after opening item (${pattern.toString()})`);
        await page.waitForTimeout(800);
        return true;
      }
    }
  }

  // Fallback: click a specific item name (works better on central Slice where item cards are not buttons).
  if (options?.itemNameHint) {
    const hint = options.itemNameHint;
    const hintRegex = new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const clicked =
      (await clickFirstVisible(page, "button", hintRegex)) ||
      (await clickFirstVisible(page, "link", hintRegex)) ||
      (await page
        .getByText(hintRegex)
        .first()
        .click({ timeout: 5000 })
        .then(
          () => true,
          () => false
        ));

    if (clicked) {
      steps.push(`Opened item details via name hint: "${hint}"`);
      await page.waitForTimeout(900);

      // Some items require choosing a size/type before enabling add.
      const firstOption =
        page.locator('input[type="radio"]').first() ??
        page.getByRole("radio").first() ??
        page.locator('button[role="radio"]').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click({ timeout: 3000 }).catch(() => undefined);
        steps.push("Selected first option (best-effort)");
        await page.waitForTimeout(500);
      }

      for (const pattern of addPatterns) {
        const btn = page.getByRole("button", { name: pattern }).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 5000 }).catch(() => undefined);
          steps.push(`Clicked add button after opening item (${pattern.toString()})`);
          await page.waitForTimeout(800);
          return true;
        }
      }
    }
  }

  return false;
}

async function verifyCart(page: Page) {
  // Some Slice UIs display a persistent "Checkout" / "View Order" button once the cart is non-empty.
  const viewOrder = page.getByRole("button", { name: /view (order|cart)/i }).first();
  if (await viewOrder.isVisible().catch(() => false)) return true;

  const checkoutWithCount = page.getByRole("button", { name: /checkout.*\\b[1-9]\\d*\\b/i }).first();
  if (await checkoutWithCount.isVisible().catch(() => false)) return true;

  const cartButton = page.getByRole("button", { name: /cart/i }).first();
  if (await cartButton.isVisible().catch(() => false)) {
    const text = (await cartButton.innerText().catch(() => "")) ?? "";
    if (/\b[1-9]\d*\b/.test(text)) return true;
  }

  // Badge-style count near the cart icon.
  const cartBadge = page
    .locator('[aria-label*="cart" i]')
    .filter({ hasText: /\b[1-9]\d*\b/ })
    .first();
  if (await cartBadge.isVisible().catch(() => false)) return true;

  const cartLink = page.locator('a[href*="cart"]').first();
  if (await cartLink.isVisible().catch(() => false)) return true;

  // Some Slice surfaces show a "Checkout" button once cart has items.
  const checkoutButton = page.getByRole("button", { name: /checkout/i }).first();
  if (await checkoutButton.isVisible().catch(() => false)) {
    return true;
  }

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
    return { deliveryAddressForm: false, deliveryAvailable: false };
  }

  steps.push("Delivery address form detected");
  await input.fill("2680 32nd St, Santa Monica, CA 90405").catch(() => undefined);
  await page.waitForTimeout(500);
  await input.press("Enter").catch(() => undefined);
  await page.waitForTimeout(800);

  // Try to select first suggestion if any.
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

  return { deliveryAddressForm: true, deliveryAvailable: !blockedByArea };
}

function detectLoginWall(bodyText: string) {
  const lower = bodyText.toLowerCase();
  const loginRequired =
    lower.includes("log in to continue") ||
    lower.includes("sign in to continue") ||
    (lower.includes("log in") && lower.includes("create account") && lower.includes("continue"));

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

function detectPaymentForm(html: string) {
  const $ = cheerio.load(html);
  const iframes = $("iframe")
    .toArray()
    .map((el) => $(el).attr("src"))
    .filter((src): src is string => typeof src === "string");

  const iframeDomains = iframes
    .map((src) => {
      try {
        return new URL(src).hostname;
      } catch {
        return null;
      }
    })
    .filter((d): d is string => Boolean(d));

  const hasStripe = iframeDomains.some((d) => d.includes("stripe.com")) || html.includes("js.stripe.com");
  const hasCardInputs =
    $('input[placeholder*="card" i]').length > 0 ||
    $('input[name*="card" i]').length > 0 ||
    html.toLowerCase().includes("card number");

  const walletOnly =
    /google pay/i.test(html) &&
    !hasCardInputs &&
    !/credit\/debit/i.test(html) &&
    !/card number/i.test(html);

  const paymentFormVisible = hasCardInputs || hasStripe || /payment/i.test(html);

  let paymentFormType: string | undefined;
  let paymentIframeDomain: string | undefined;

  if (walletOnly) {
    paymentFormType = "wallet_only";
  } else if (hasStripe) {
    paymentFormType = "stripe_iframe";
    paymentIframeDomain = iframeDomains.find((d) => d.includes("stripe.com"));
  } else if (hasCardInputs) {
    paymentFormType = "standard_inputs";
  }

  return { paymentFormVisible, paymentFormType, paymentIframeDomain };
}

function detectTipAndTotal(bodyText: string) {
  const tipSelectionPresent = /tip/i.test(bodyText) && (/\b10%\b/.test(bodyText) || /\b15%\b/.test(bodyText));

  const matchTotal = bodyText.match(/\btotal\b[^$]*\$\s?(\d+(?:\.\d{2})?)/i);
  const orderTotalVisible = Boolean(matchTotal);
  const estimatedTotal = matchTotal ? `$${matchTotal[1]}` : undefined;

  return { tipSelectionPresent, orderTotalVisible, estimatedTotal };
}

export async function probeSliceSurfaceOnce(options: {
  url: string;
  isWhiteLabel: boolean;
  runIndex: number;
  screenshotDir: string;
  humanDelayMs?: number;
}) {
  const start = Date.now();
  const domain = toDomain(options.url);
  const slug = `${options.isWhiteLabel ? "white-label" : "central"}-${safeSlug(domain)}-run-${options.runIndex}`;

  const screenshotPath = (name: string) =>
    path.join(options.screenshotDir, `${slug}-${name}.png`);

  const browser = await chromium.launch({ headless: true });
  const steps: string[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    const t0 = Date.now();
    const response = await page.goto(options.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await waitForSliceRender(page);
    const loadTimeMs = Date.now() - t0;
    const wafHeaders = pickWafHeaders((await response?.allHeaders().catch(() => ({}))) ?? {});

    await delay(options.humanDelayMs ?? 1200);
    await bestEffortDismissOverlays(page, steps);
    const block = await detectBotBlock(page);
    await page.screenshot({ path: screenshotPath("initial"), fullPage: true });

    const pageLoad = {
      success: Boolean(response) && response?.ok() === true && !block.blocked,
      loadTimeMs,
      botDetectionEncountered: block.blocked,
      botDetectionType: block.blocked ? block.type : "none",
      wafHeaders,
      screenshotPath: path.relative(process.cwd(), screenshotPath("initial")),
    };

    // Menu scrape from rendered HTML (still SSR on Slice).
    const menuScreenshot = screenshotPath("menu");
    await page.screenshot({ path: menuScreenshot, fullPage: true });

    const html = await page.content();
    const menuContext = extractInitialDataContextJson(html);
    const redux = extractSliceReduxStateJson(html);
    const menu = menuContext
      ? findSliceMenuPayload(menuContext)
      : redux
        ? findSliceMenuFromReduxState(redux)
        : null;
    const domMenu = !menu ? await scrapeSliceMenuFromDom(page) : null;

    const categories = menu
      ? menu.categories.map((c) => ({ name: c.name, itemCount: c.products.length }))
      : domMenu
        ? domMenu.categories
        : [];
    const totalItems = menu
      ? menu.categories.reduce((sum, c) => sum + c.products.length, 0)
      : domMenu
        ? domMenu.items.length
        : 0;
    const sampleItems = menu
      ? menu.categories
          .flatMap((c) => c.products.map((p) => ({ ...p, category: c.name })))
          .slice(0, 5)
          .map((p) => ({ name: p.name, price: p.price, hasImage: Boolean(p.image) }))
      : domMenu
        ? domMenu.items.slice(0, 5).map((p) => ({ name: p.name, price: p.price, hasImage: p.hasImage }))
        : [];

    const menuScrape = {
      success: totalItems > 0,
      isSSR: Boolean(menu),
      totalItems,
      categories,
      sampleItems,
      screenshotPath: path.relative(process.cwd(), menuScreenshot),
    };

    // Add to cart.
    const addScreenshot = screenshotPath("add-to-cart");
    const addOk =
      block.blocked
        ? false
        : await addFirstItemToCart(page, steps, { itemNameHint: sampleItems[0]?.name });
    await delay(options.humanDelayMs ?? 1200);
    const cartVerified = addOk ? await verifyCart(page) : false;
    await page.screenshot({ path: addScreenshot, fullPage: true });

    const addToCart = {
      success: addOk,
      interactionSteps: steps.slice(),
      cartVerified,
      screenshotPath: path.relative(process.cwd(), addScreenshot),
    };

    // Checkout.
    const checkoutSteps: string[] = [];
    const checkoutScreenshot = screenshotPath("checkout");
    const reachedCheckout = addOk ? await reachCheckout(page, checkoutSteps) : false;
    await delay(options.humanDelayMs ?? 1200);

    const { deliveryAddressForm, deliveryAvailable } = reachedCheckout
      ? await fillDeliveryAddressIfPresent(page, checkoutSteps)
      : { deliveryAddressForm: false, deliveryAvailable: false };

    await delay(options.humanDelayMs ?? 1200);
    const checkoutHtml = reachedCheckout ? await page.content() : "";
    const checkoutText = reachedCheckout
      ? await page.locator("body").innerText({ timeout: 4000 }).catch(() => "")
      : "";

    const login = reachedCheckout ? detectLoginWall(checkoutText) : { loginRequired: false, loginType: "none" as const };
    const payment = reachedCheckout ? detectPaymentForm(checkoutHtml) : { paymentFormVisible: false, paymentFormType: undefined, paymentIframeDomain: undefined };
    const tipTotal = reachedCheckout ? detectTipAndTotal(checkoutText) : { tipSelectionPresent: false, orderTotalVisible: false, estimatedTotal: undefined };

    await page.screenshot({ path: checkoutScreenshot, fullPage: true });

    const checkout = {
      reached: reachedCheckout,
      loginRequired: login.loginRequired,
      loginType: login.loginType === "none" ? undefined : login.loginType,
      deliveryAddressForm,
      deliveryAvailable,
      paymentFormVisible: payment.paymentFormVisible,
      paymentFormType: payment.paymentFormType,
      paymentIframeDomain: payment.paymentIframeDomain,
      tipSelectionPresent: tipTotal.tipSelectionPresent,
      orderTotalVisible: tipTotal.orderTotalVisible,
      estimatedTotal: tipTotal.estimatedTotal,
      screenshotPath: path.relative(process.cwd(), checkoutScreenshot),
    };

    return {
      ok: true as const,
      run: {
        target: { url: options.url, domain, isWhiteLabel: options.isWhiteLabel },
        pageLoad,
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

function scoreSliceResult(result: SliceProbeResult) {
  let score = 0;

  if (result.pageLoad.success && !result.pageLoad.botDetectionEncountered) score += 15;
  if (result.menuScrape.isSSR) score += 10;
  if (result.menuScrape.success) score += 10;
  if (result.addToCart.success && result.addToCart.cartVerified) score += 15;
  if (!result.checkout.loginRequired && result.checkout.reached) score += 20;

  const paymentAutomatable =
    result.checkout.paymentFormType === "standard_inputs" ||
    result.checkout.paymentFormType === "stripe_iframe";
  if (result.checkout.paymentFormVisible && paymentAutomatable) score += 10;
  if (result.checkout.deliveryAvailable || !result.checkout.deliveryAddressForm) score += 10;
  if (result.consistency.runsSuccessful === 3 && !result.consistency.behaviorChanged) score += 10;

  return Math.max(0, Math.min(100, score));
}

function toRecommendation(score: number): SliceProbeResult["recommendation"] {
  if (score >= 80) return "bot-ready";
  if (score >= 50) return "needs-investigation";
  return "human-ops-only";
}

function buildBlockersAndAdvantages(result: SliceProbeResult) {
  const blockers: string[] = [];
  const advantages: string[] = [];

  if (result.pageLoad.botDetectionEncountered) {
    blockers.push(`Bot detection encountered: ${result.pageLoad.botDetectionType ?? "unknown"}`);
  } else {
    advantages.push("No bot challenge observed on page load");
  }

  if (result.menuScrape.isSSR) {
    advantages.push("Menu appears SSR (scrapable via plain HTTP fetch)");
  } else {
    advantages.push("Menu requires JS render (Playwright needed)");
  }

  if (result.addToCart.success && result.addToCart.cartVerified) {
    advantages.push("Add-to-cart is automatable");
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
  } else if (result.checkout.paymentFormType === "wallet_only") {
    blockers.push("Payment appears wallet-only (no visible guest card entry)");
  } else if (result.checkout.paymentFormType === "stripe_iframe") {
    advantages.push("Stripe iframe detected (potentially automatable with a controlled payment flow)");
  } else if (result.checkout.paymentFormType === "standard_inputs") {
    advantages.push("Standard card inputs detected");
  }

  if (result.checkout.deliveryAddressForm && !result.checkout.deliveryAvailable) {
    blockers.push("Delivery not available to the test hotel address");
  } else if (result.checkout.deliveryAvailable) {
    advantages.push("Delivery appears available for the test hotel address");
  }

  return { blockers, advantages };
}

export async function runSliceProbe(options: {
  url: string;
  isWhiteLabel: boolean;
  runs: number;
  screenshotDir: string;
}) {
  const domain = toDomain(options.url);

  // Confirm SSR menu via plain HTTP fetch (once).
  const httpMenu = await extractMenuFromHttp(options.url);
  const ssrMenuOk = httpMenu.ok;

  const runResults: Array<{
    pageLoadOk: boolean;
    botBlocked: boolean;
    addOk: boolean;
    checkoutReached: boolean;
    loginRequired: boolean;
  }> = [];

  let best: SliceProbeResult | null = null;
  let successfulRuns = 0;
  let sawBotBlockAfterSuccess = false;

  for (let i = 1; i <= options.runs; i += 1) {
    const run = await probeSliceSurfaceOnce({
      url: options.url,
      isWhiteLabel: options.isWhiteLabel,
      runIndex: i,
      screenshotDir: options.screenshotDir,
    });

    if (!run.ok || !run.run) {
      runResults.push({
        pageLoadOk: false,
        botBlocked: false,
        addOk: false,
        checkoutReached: false,
        loginRequired: false,
      });
      await delay(30_000);
      continue;
    }

    const pageLoadOk = run.run.pageLoad.success;
    const botBlocked = run.run.pageLoad.botDetectionEncountered;
    const addOk = run.run.addToCart.success && run.run.addToCart.cartVerified;
    const checkoutReached = run.run.checkout.reached;
    const loginRequired = run.run.checkout.loginRequired;

    const runOk = pageLoadOk && !botBlocked;
    if (runOk) {
      successfulRuns += 1;
    } else if (successfulRuns > 0 && botBlocked) {
      sawBotBlockAfterSuccess = true;
    }

    runResults.push({ pageLoadOk, botBlocked, addOk, checkoutReached, loginRequired });

    // Pick a "best" run for the representative scorecard: prefer reaching checkout and seeing payment.
    if (!best) {
      best = {
        ...run.run,
        menuScrape: { ...run.run.menuScrape, isSSR: ssrMenuOk },
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
        (checkoutReached ? 2 : 0) + (addOk ? 1 : 0);
      if (candidateRank > bestRank) {
        best = {
          ...run.run,
          menuScrape: { ...run.run.menuScrape, isSSR: ssrMenuOk },
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

  if (!best) {
    const screenshot = path.join(options.screenshotDir, `${safeSlug(domain)}-initial.png`);
    best = {
      target: { url: options.url, domain, isWhiteLabel: options.isWhiteLabel },
      pageLoad: {
        success: false,
        loadTimeMs: 0,
        botDetectionEncountered: false,
        botDetectionType: "none",
        wafHeaders: {},
        screenshotPath: path.relative(process.cwd(), screenshot),
      },
      menuScrape: {
        success: false,
        isSSR: ssrMenuOk,
        totalItems: 0,
        categories: [],
        sampleItems: [],
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
        loginRequired: false,
        deliveryAddressForm: false,
        deliveryAvailable: false,
        paymentFormVisible: false,
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
        const parts = [];
        parts.push(r.addOk ? "add ok" : "add failed");
        parts.push(r.checkoutReached ? "checkout reached" : "checkout not reached");
        if (r.loginRequired) parts.push("login required");
        return `run ${i}: ${parts.join(", ")}`;
      })
      .join(" | "),
  };

  best.injectabilityScore = scoreSliceResult(best);
  best.recommendation = toRecommendation(best.injectabilityScore);
  const analysis = buildBlockersAndAdvantages(best);
  best.blockers = analysis.blockers;
  best.advantages = analysis.advantages;

  return best;
}
