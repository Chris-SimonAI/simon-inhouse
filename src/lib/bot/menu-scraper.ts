import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { env } from '@/env';
import {
  applyAutomationInitScript,
  BOT_USER_AGENT,
  buildChromiumLaunchOptions,
  delay,
  ensureNoCloudflareBlock,
  getScraperProxyUrl,
  stabilizePage,
} from '@/lib/bot/browser-automation';
import { logBotRunTelemetry } from '@/lib/bot/bot-telemetry';

export interface ModifierOption {
  name: string;
  price: number;
  groupName?: string;
}

export interface ModifierGroup {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  modifiers?: ModifierOption[];
  modifierGroups?: ModifierGroup[];
}

export interface RestaurantHours {
  [day: string]: Array<{ open: string; close: string }>;
}

export interface RestaurantAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
}

export interface ScrapedMenu {
  restaurantName: string;
  restaurantSlug: string;
  url: string;
  items: MenuItem[];
  categories: string[];
  scrapedAt: string;
  hours?: RestaurantHours;
  heroImage?: string;
  address?: RestaurantAddress;
  deliveryEta?: string;
}

const WEB_UNLOCKER_URL = 'https://api.brightdata.com/request';
const WEB_UNLOCKER_ZONE = env.BRIGHTDATA_WEB_UNLOCKER_ZONE || 'web_unlocker1';
const WEB_UNLOCKER_MAX_ATTEMPTS = 2;
const PLAYWRIGHT_FETCH_MAX_ATTEMPTS = 2;

interface FetchTelemetryContext {
  cfDetected: boolean;
  unlockerUsed: boolean;
}

type OrderingPlatform = "toast" | "chownow";

function detectOrderingPlatform(url: string): OrderingPlatform | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes("toasttab.com")) {
      return "toast";
    }

    if (host.endsWith("chownow.com") && path.includes("/order/")) {
      return "chownow";
    }

    return null;
  } catch {
    return null;
  }
}

function parseChowNowLocationId(orderingUrl: string): string {
  const parsed = new URL(orderingUrl);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const locationsIndex = parts.indexOf("locations");
  if (locationsIndex === -1 || parts.length < locationsIndex + 2) {
    throw new Error("ChowNow ordering URL missing locations segment.");
  }

  const locationId = parts[locationsIndex + 1];
  if (!locationId || !/^\d+$/.test(locationId)) {
    throw new Error("ChowNow ordering URL has invalid location id.");
  }

  return locationId;
}

async function fetchJsonResilient(url: string, telemetry: FetchTelemetryContext): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": BOT_USER_AGENT,
  };

  for (let attempt = 1; attempt <= PLAYWRIGHT_FETCH_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, { headers });
    const contentType = response.headers.get("content-type") ?? "";
    const bodyText = await response.text();

    if (!response.ok) {
      // Cloudflare sometimes replies with HTML + 4xx/5xx.
      if (contentType.includes("text/html") && isCloudflareBlockedHtml(bodyText)) {
        telemetry.cfDetected = true;
        break;
      }
      continue;
    }

    if (!contentType.includes("application/json")) {
      if (contentType.includes("text/html") && isCloudflareBlockedHtml(bodyText)) {
        telemetry.cfDetected = true;
        break;
      }
      continue;
    }

    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      continue;
    }
  }

  // Fallback to Web Unlocker if native fetch didn't produce JSON.
  const unlocked = await fetchWithWebUnlocker(url, telemetry);
  telemetry.unlockerUsed = true;
  return JSON.parse(unlocked) as unknown;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string") as string[];
}

async function scrapeChowNowMenuViaApi(
  restaurantUrl: string,
  options: { skipModifiers: boolean },
  telemetry: FetchTelemetryContext,
): Promise<ScrapedMenu> {
  const locationId = parseChowNowLocationId(restaurantUrl);

  const restaurantJson = await fetchJsonResilient(
    `https://api.chownow.com/api/restaurant/${locationId}`,
    telemetry,
  );

  const menuJson = await fetchJsonResilient(
    `https://api.chownow.com/api/restaurant/${locationId}/menu`,
    telemetry,
  );

  if (!isRecord(restaurantJson) || !isRecord(menuJson)) {
    throw new Error("ChowNow API returned unexpected payload shape.");
  }

  const restaurantName = coerceString(restaurantJson["name"]) ?? "Restaurant";

  const address: RestaurantAddress | undefined = (() => {
    const raw = restaurantJson["address"];
    if (!isRecord(raw)) {
      return undefined;
    }

    return {
      addressLine1: coerceString(raw["street_address1"]) ?? undefined,
      addressLine2: coerceString(raw["street_address2"]) ?? undefined,
      city: coerceString(raw["city"]) ?? undefined,
      state: coerceString(raw["state"]) ?? undefined,
      zipCode: coerceString(raw["zip"]) ?? undefined,
      country: coerceString(raw["country"]) ?? undefined,
      phoneNumber: coerceString(restaurantJson["phone"]) ?? undefined,
      latitude: coerceNumber(raw["latitude"]) ?? undefined,
      longitude: coerceNumber(raw["longitude"]) ?? undefined,
    };
  })();

  const modifierById = new Map<string, { name: string; price: number }>();
  const modifiersRaw = menuJson["modifiers"];
  if (Array.isArray(modifiersRaw)) {
    for (const entry of modifiersRaw) {
      if (!isRecord(entry)) {
        continue;
      }
      const id = coerceString(entry["id"]);
      const name = coerceString(entry["name"]);
      const price = coerceNumber(entry["price"]) ?? 0;
      if (!id || !name) {
        continue;
      }
      modifierById.set(id, { name, price });
    }
  }

  const modifierCategoryById = new Map<
    string,
    {
      name: string;
      modifierIds: string[];
      minQty: number;
      maxQty: number | null;
    }
  >();

  const modifierCategoriesRaw = menuJson["modifier_categories"];
  if (Array.isArray(modifierCategoriesRaw)) {
    for (const entry of modifierCategoriesRaw) {
      if (!isRecord(entry)) {
        continue;
      }
      const id = coerceString(entry["id"]);
      const name = coerceString(entry["name"]);
      if (!id || !name) {
        continue;
      }

      const modifierIds = coerceStringArray(entry["modifiers"]);
      const minQty = coerceNumber(entry["min_qty"]) ?? 0;
      const maxQty = coerceNumber(entry["max_qty"]);

      modifierCategoryById.set(id, {
        name,
        modifierIds,
        minQty,
        maxQty: maxQty === null ? null : maxQty,
      });
    }
  }

  const menuCategoriesRaw = menuJson["menu_categories"];
  if (!Array.isArray(menuCategoriesRaw) || menuCategoriesRaw.length === 0) {
    throw new Error("ChowNow API returned empty menu_categories.");
  }

  const items: MenuItem[] = [];
  const categories: string[] = [];

  for (const categoryEntry of menuCategoriesRaw) {
    if (!isRecord(categoryEntry)) {
      continue;
    }
    const categoryName = coerceString(categoryEntry["name"]) ?? "Menu";
    categories.push(categoryName);

    const itemEntries = categoryEntry["items"];
    if (!Array.isArray(itemEntries)) {
      continue;
    }

    for (const itemEntry of itemEntries) {
      if (!isRecord(itemEntry)) {
        continue;
      }

      const isMeta = itemEntry["is_meta"];
      if (typeof isMeta === "boolean" && isMeta) {
        continue;
      }

      const id = coerceString(itemEntry["id"]);
      const name = coerceString(itemEntry["name"]);
      if (!id || !name) {
        continue;
      }

      const description = coerceString(itemEntry["description"]) ?? "";
      const price = coerceNumber(itemEntry["price"]) ?? 0;
      const image = coerceString(itemEntry["image"]) ?? undefined;

      let modifierGroups: ModifierGroup[] | undefined;
      let flatModifiers: ModifierOption[] | undefined;

      if (!options.skipModifiers) {
        const modifierCategoryIds = coerceStringArray(itemEntry["modifier_categories"]);
        const groups: ModifierGroup[] = [];
        const flat: ModifierOption[] = [];

        for (const modifierCategoryId of modifierCategoryIds) {
          const category = modifierCategoryById.get(modifierCategoryId);
          if (!category) {
            continue;
          }

          const optionRecords = category.modifierIds
            .map((modifierId) => modifierById.get(modifierId))
            .filter((option): option is { name: string; price: number } => Boolean(option));

          if (optionRecords.length === 0) {
            continue;
          }

          const maxSelections =
            category.maxQty === null
              ? optionRecords.length
              : Math.max(1, Math.min(optionRecords.length, category.maxQty));

          const minSelections = Math.max(0, Math.min(maxSelections, category.minQty));
          const required = minSelections > 0;

          const options = optionRecords.map((option) => ({
            name: option.name,
            price: option.price,
          }));

          groups.push({
            name: category.name,
            required,
            minSelections,
            maxSelections,
            options,
          });

          for (const option of options) {
            flat.push({ name: option.name, price: option.price, groupName: category.name });
          }
        }

        modifierGroups = groups;
        flatModifiers = flat;
      }

      items.push({
        id,
        name,
        description,
        price,
        category: categoryName,
        image,
        modifiers: flatModifiers ?? [],
        modifierGroups: modifierGroups ?? [],
      });
    }
  }

  const uniqueCategories = [...new Set(categories.map((name) => name.trim()).filter(Boolean))];
  if (items.length === 0) {
    throw new Error("ChowNow API returned no menu items.");
  }

  return {
    restaurantName,
    restaurantSlug: buildChowNowSlug(restaurantUrl),
    url: restaurantUrl,
    items,
    categories: uniqueCategories.length > 0 ? uniqueCategories : ["Menu"],
    scrapedAt: new Date().toISOString(),
    address,
  };
}

function hasToastMenuSignals(html: string): boolean {
  return (
    html.includes('data-testid="menu-item-card"') ||
    html.includes('data-testid=\\"menu-item-card\\"') ||
    html.includes('menu-item-card')
  );
}

function hasChowNowDomSignals(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("powered by chownow") ||
    lower.includes("online ordering") ||
    lower.includes("add to cart") ||
    lower.includes("pickup") ||
    lower.includes("delivery")
  );
}

function isCloudflareBlockedHtml(html: string): boolean {
  const lower = html.toLowerCase();
  const blockedSignals = [
    'just a moment',
    'attention required',
    'checking your browser',
    'verify you are human',
    'cf-browser-verification',
    'cloudflare',
    'cf-ray',
  ];

  return blockedSignals.some((signal) => lower.includes(signal));
}

/**
 * Fetch a URL using Bright Data's Web Unlocker API
 * Handles Cloudflare and other anti-bot protections automatically
 */
async function fetchWithWebUnlocker(url: string, telemetry: FetchTelemetryContext): Promise<string> {
  const apiKey = env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error('BRIGHTDATA_API_KEY environment variable is not set');
  }
  telemetry.unlockerUsed = true;

  console.log(`  Fetching via Web Unlocker: ${url}`);

  const response = await fetch(WEB_UNLOCKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone: WEB_UNLOCKER_ZONE,
      url,
      format: 'raw',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Web Unlocker API error: ${response.status} - ${errorText}`);
  }

  return response.text();
}

async function fetchWithPlaywrightProxy(
  url: string,
  contextLabel: string,
  telemetry: FetchTelemetryContext,
): Promise<string> {
  const proxyUrl = getScraperProxyUrl();
  const launchOptions = buildChromiumLaunchOptions(proxyUrl);

  const browser = await chromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      userAgent: BOT_USER_AGENT,
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: Boolean(proxyUrl),
    });

    await applyAutomationInitScript(context);

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await stabilizePage(page);
    const blocked = await ensureNoCloudflareBlock(page, contextLabel);
    telemetry.cfDetected = telemetry.cfDetected || blocked;
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchMenuHtmlResilient(url: string, telemetry: FetchTelemetryContext): Promise<string> {
  const errors: string[] = [];

  for (let attempt = 1; attempt <= WEB_UNLOCKER_MAX_ATTEMPTS; attempt++) {
    try {
      const html = await fetchWithWebUnlocker(url, telemetry);
      if (isCloudflareBlockedHtml(html)) {
        telemetry.cfDetected = true;
        const message = `Web Unlocker attempt ${attempt} returned Cloudflare block page`;
        errors.push(message);
        console.log(`  ${message}`);
        await delay(attempt * 1200);
        continue;
      }
      if (!hasToastMenuSignals(html)) {
        const message = `Web Unlocker attempt ${attempt} did not return Toast menu markup`;
        errors.push(message);
        console.log(`  ${message}`);
        await delay(attempt * 1200);
        continue;
      }
      return html;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Web Unlocker attempt ${attempt} failed: ${message}`);
      await delay(attempt * 1200);
    }
  }

  for (let attempt = 1; attempt <= PLAYWRIGHT_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`  Falling back to Playwright fetch (attempt ${attempt})...`);
      const html = await fetchWithPlaywrightProxy(url, `menu-fetch-${attempt}`, telemetry);
      if (isCloudflareBlockedHtml(html) || !hasToastMenuSignals(html)) {
        if (isCloudflareBlockedHtml(html)) {
          telemetry.cfDetected = true;
        }
        const message = `Playwright fallback attempt ${attempt} still returned blocked/non-menu markup`;
        errors.push(message);
        await delay(attempt * 1500);
        continue;
      }
      return html;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Playwright fallback attempt ${attempt} failed: ${message}`);
      await delay(attempt * 1500);
    }
  }

  throw new Error(`Unable to fetch Toast menu page. ${errors.join(' | ')}`);
}

type JsonCandidate = {
  url: string;
  json: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePriceToNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Heuristic: treat large integers as cents.
    if (Number.isInteger(value) && value >= 1000) {
      return value / 100;
    }
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseFloat(match[0]);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (parsed >= 1000 && !value.includes(".")) {
      return parsed / 100;
    }
    return parsed;
  }

  return null;
}

type ExtractedMenuItem = {
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
};

function looksLikeMenuSection(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const name = value["name"];
  if (typeof name !== "string" || name.trim().length < 2) {
    return false;
  }

  const maybeItems =
    value["items"] ??
    value["products"] ??
    value["menu_items"] ??
    value["menuItems"] ??
    value["children"];

  return Array.isArray(maybeItems) && maybeItems.length > 0;
}

function extractChowNowMenuItemsFromJson(
  json: unknown,
): { restaurantName: string | null; items: ExtractedMenuItem[] } {
  const items: ExtractedMenuItem[] = [];
  let restaurantName: string | null = null;

  const seen = new Set<string>();

  function normalizeKey(text: string) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function recordItem(candidate: ExtractedMenuItem) {
    const key = `${normalizeKey(candidate.category)}|${normalizeKey(candidate.name)}|${candidate.price.toFixed(2)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push(candidate);
  }

  function maybeSetRestaurantName(obj: Record<string, unknown>, path: string[]) {
    if (restaurantName) {
      return;
    }
    const name = obj["name"];
    if (typeof name !== "string") {
      return;
    }
    const normalizedPath = path.join(".").toLowerCase();
    if (
      normalizedPath.includes("restaurant") ||
      normalizedPath.includes("location") ||
      normalizedPath.includes("vendor") ||
      normalizedPath.includes("store")
    ) {
      const cleaned = name.trim();
      if (cleaned.length >= 2 && cleaned.length <= 80) {
        restaurantName = cleaned;
      }
    }
  }

  function walk(value: unknown, path: string[], categoryContext: string | null) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        walk(value[i], [...path, String(i)], categoryContext);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    maybeSetRestaurantName(value, path);

    let nextCategory = categoryContext;
    if (looksLikeMenuSection(value)) {
      const sectionName = value["name"];
      if (typeof sectionName === "string") {
        nextCategory = sectionName.trim();
      }
    } else {
      // Explicitly type as unknown to avoid TS inferring an impossible type
      // when traversing arbitrary JSON payloads.
      const explicitCategoryRaw: unknown =
        value["category"] ??
        value["category_name"] ??
        value["categoryName"] ??
        value["section_name"] ??
        value["sectionName"];

      if (typeof explicitCategoryRaw === "string") {
        const trimmed = explicitCategoryRaw.trim();
        if (trimmed) {
          nextCategory = trimmed;
        }
      }
    }

    const nameValue = value["name"];
    const descriptionValue = value["description"] ?? value["desc"] ?? value["details"];
    const imageValue =
      value["image_url"] ??
      value["imageUrl"] ??
      value["image"] ??
      value["photo_url"] ??
      value["photoUrl"];

    const priceValue =
      value["price"] ??
      value["price_cents"] ??
      value["priceCents"] ??
      value["amount"] ??
      value["amount_cents"] ??
      value["amountCents"] ??
      value["base_price"] ??
      value["basePrice"];

    if (typeof nameValue === "string") {
      const candidateName = nameValue.trim();
      const candidatePrice = parsePriceToNumber(priceValue);

      // Avoid treating the restaurant itself as a menu item.
      const normalizedPath = path.join(".").toLowerCase();
      const inRestaurantObject =
        normalizedPath.includes("restaurant") || normalizedPath.includes("location");

      if (
        !inRestaurantObject &&
        candidatePrice !== null &&
        candidatePrice >= 0 &&
        candidatePrice <= 400 &&
        candidateName.length >= 2 &&
        candidateName.length <= 120
      ) {
        recordItem({
          name: candidateName,
          description: typeof descriptionValue === "string" ? descriptionValue.trim() : "",
          price: candidatePrice,
          category: nextCategory ?? "Menu",
          image: typeof imageValue === "string" ? imageValue : undefined,
        });
      }
    }

    for (const [key, child] of Object.entries(value)) {
      walk(child, [...path, key], nextCategory);
    }
  }

  walk(json, [], null);

  return {
    restaurantName,
    items,
  };
}

function pickBestChowNowJsonCandidate(candidates: JsonCandidate[]) {
  let best: { candidate: JsonCandidate; itemCount: number } | null = null;

  for (const candidate of candidates) {
    const extracted = extractChowNowMenuItemsFromJson(candidate.json);
    if (extracted.items.length < 10) {
      continue;
    }

    if (!best || extracted.items.length > best.itemCount) {
      best = { candidate, itemCount: extracted.items.length };
    }
  }

  return best?.candidate ?? null;
}

async function scrapeChowNowMenuWithPlaywright(
  restaurantUrl: string,
  options: { skipModifiers: boolean },
  telemetry: FetchTelemetryContext,
): Promise<ScrapedMenu> {
  // Prefer the public ChowNow API (more reliable and faster than headless DOM scraping).
  try {
    const apiMenu = await scrapeChowNowMenuViaApi(restaurantUrl, options, telemetry);
    console.log(`  [chownow] API scrape succeeded (${apiMenu.items.length} items)`);
    return apiMenu;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  [chownow] API scrape failed, falling back to Playwright: ${message}`);
  }

  const proxyUrl = getScraperProxyUrl();
  const launchOptions = buildChromiumLaunchOptions(proxyUrl);
  const browser = await chromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      userAgent: BOT_USER_AGENT,
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: Boolean(proxyUrl),
    });

    await applyAutomationInitScript(context);

    const page = await context.newPage();

    const jsonCandidates: JsonCandidate[] = [];
    page.on("response", async (response) => {
      const url = response.url();
      const request = response.request();
      const resourceType = request.resourceType();
      if (resourceType !== "xhr" && resourceType !== "fetch") {
        return;
      }

      if (!/chownow/i.test(url)) {
        return;
      }

      const headers = response.headers();
      const contentType = headers["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        return;
      }

      try {
        const json = await response.json();
        jsonCandidates.push({ url, json });
      } catch {
        // ignore
      }
    });

    await page.goto(restaurantUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await stabilizePage(page);

    const blocked = await ensureNoCloudflareBlock(page, "chownow-menu");
    telemetry.cfDetected = telemetry.cfDetected || blocked;

    // Give the app time to fetch menu JSON and render.
    await page.waitForLoadState("networkidle").catch(() => {});
    await delay(4000);

    const best = pickBestChowNowJsonCandidate(jsonCandidates);
    let extracted: { restaurantName: string | null; items: ExtractedMenuItem[] } | null = null;
    if (best) {
      extracted = extractChowNowMenuItemsFromJson(best.json);
      console.log(`  [chownow] Using menu payload from ${best.url} (${extracted.items.length} items)`);
    }

    const html = await page.content();
    if (!extracted || extracted.items.length === 0) {
      if (!hasChowNowDomSignals(html)) {
        throw new Error("ChowNow page did not render expected ordering content (possible block or app change).");
      }

      // As a last resort, try a naive DOM parse for item-name + price patterns.
      const $ = cheerio.load(html);
      const fallbackItems: ExtractedMenuItem[] = [];
      const cardTextNodes = $("body")
        .find("div, li, a, button")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get()
        .filter((text) => text.length >= 5 && text.length <= 160);

      for (const text of cardTextNodes) {
        const priceMatch = text.match(/\$\\s*(\\d+(?:\\.\\d{2})?)/);
        if (!priceMatch) {
          continue;
        }
        const price = Number.parseFloat(priceMatch[1]);
        if (!Number.isFinite(price) || price <= 0 || price > 400) {
          continue;
        }

        // Heuristic: name is the part before the price.
        const name = text.split(priceMatch[0])[0]?.trim();
        if (!name || name.length < 2 || name.length > 120) {
          continue;
        }
        fallbackItems.push({ name, description: "", price, category: "Menu" });
      }

      extracted = {
        restaurantName: null,
        items: dedupeExtractedItems(fallbackItems),
      };
    }

    if (!extracted || extracted.items.length === 0) {
      throw new Error("Unable to extract ChowNow menu items (no candidates found).");
    }

    const restaurantName =
      extracted.restaurantName ?? (await page.title().catch(() => ""))?.split("|")[0]?.trim() ?? "Restaurant";

    const slug = buildChowNowSlug(restaurantUrl);
    const uniqueCategories = [...new Set(extracted.items.map((item) => item.category || "Menu"))];

    // ChowNow modifiers are not implemented yet (platform-specific UI).
    if (!options.skipModifiers) {
      console.log("  [chownow] Modifier scraping not implemented; continuing with base items only.");
    }

    return {
      restaurantName,
      restaurantSlug: slug,
      url: restaurantUrl,
      items: extracted.items.map((item, index) => ({
        id: `item-${index}`,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category || "Menu",
        image: item.image,
        modifiers: [],
        modifierGroups: [],
      })),
      categories: uniqueCategories.length > 0 ? uniqueCategories : ["Menu"],
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

function dedupeExtractedItems(items: ExtractedMenuItem[]): ExtractedMenuItem[] {
  const seen = new Set<string>();
  const output: ExtractedMenuItem[] = [];
  for (const item of items) {
    const key = `${item.category.toLowerCase()}|${item.name.toLowerCase()}|${item.price.toFixed(2)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildChowNowSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const orderIndex = parts.indexOf("order");
    if (orderIndex !== -1 && parts.length >= orderIndex + 4) {
      const orderId = parts[orderIndex + 1];
      const locationId = parts[orderIndex + 3];
      return `chownow-${orderId}-${locationId}`;
    }
  } catch {
    // ignore
  }
  return "chownow";
}

/**
 * Extract address from page text
 */
function extractAddress(pageText: string): RestaurantAddress | undefined {
  let addressLine1 = '';
  let city = '';
  let state = '';
  let zipCode = '';

  // Look for "Pickup from" text which has full address
  const pickupMatch = pageText.match(/Pickup\s+from\s+(\d+\s+[^,]+),\s*([^,]+),\s*([A-Z]{2})/i);
  if (pickupMatch) {
    addressLine1 = pickupMatch[1].trim();
    city = pickupMatch[2].trim();
    state = pickupMatch[3].trim();
  }

  // Look for City, ST ZIP pattern
  if (!zipCode) {
    const cityStateZipMatch = pageText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5})/);
    if (cityStateZipMatch) {
      if (!city) city = cityStateZipMatch[1].trim();
      if (!state) state = cityStateZipMatch[2].trim();
      zipCode = cityStateZipMatch[3].trim();
    }
  }

  // Look for street address pattern
  if (!addressLine1) {
    const streetMatch = pageText.match(/(\d+\s+[\w\s]+(?:Boulevard|Blvd|Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Way|Lane|Ln|Place|Pl|Court|Ct))\b/i);
    if (streetMatch) {
      addressLine1 = streetMatch[1].trim();
    }
  }

  // Get phone number
  const phoneMatch = pageText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phoneNumber = phoneMatch ? phoneMatch[0] : undefined;

  if (addressLine1 || city || state || zipCode) {
    return {
      addressLine1: addressLine1 || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
      country: 'USA',
      phoneNumber,
    };
  }

  return phoneNumber ? { phoneNumber } : undefined;
}

/**
 * Extract delivery ETA from page text
 */
function extractDeliveryEta(pageText: string): string | undefined {
  const etaPatterns = [
    /estimated\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
    /(\d+\s*-\s*\d+\s*min)/i,
    /delivery\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
  ];

  for (const pattern of etaPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Parse modifiers from item detail page HTML
 */
function parseModifiers($: cheerio.CheerioAPI, itemName: string): { modifierGroups: ModifierGroup[]; flatModifiers: ModifierOption[] } {
  const groups: ModifierGroup[] = [];
  const flatModifiers: ModifierOption[] = [];
  const seenOptions = new Set<string>();

  // Find modifier sections
  const modSections = $('.modSection');

  modSections.each((_, section) => {
    const $section = $(section);

    // Get group name
    let groupName = $section.find('.modSectionTitle').first().text().trim() || 'Options';
    groupName = groupName.replace(/Required$/i, '').trim();

    // Get selection rules from subtitle
    const subtitleText = $section.find('.modSectionSubtitle').text().toLowerCase();

    // Determine if required
    const hasRequiredBadge = $section.find('.modSectionTitleContainer').text().includes('Required');
    const hasRadios = $section.find('input[type="radio"]').length > 0;
    const isRequired = hasRequiredBadge || hasRadios;

    // Parse selection counts
    let minSelections = 0;
    let maxSelections = 10;

    const exactMatch = subtitleText.match(/select\s+(\d+)$/);
    if (exactMatch) {
      minSelections = parseInt(exactMatch[1]);
      maxSelections = parseInt(exactMatch[1]);
    }

    const rangeMatch = subtitleText.match(/select\s+(\d+)\s+to\s+(\d+)/);
    if (rangeMatch) {
      minSelections = parseInt(rangeMatch[1]);
      maxSelections = parseInt(rangeMatch[2]);
    }

    const upToMatch = subtitleText.match(/(?:up\s+to|max(?:imum)?)\s+(\d+)/);
    if (upToMatch) {
      maxSelections = parseInt(upToMatch[1]);
    }

    if (subtitleText.includes('optional')) {
      minSelections = 0;
    }

    if (isRequired && minSelections === 0) {
      minSelections = 1;
    }

    if (hasRadios) {
      maxSelections = 1;
    }

    // Get options
    const options: Array<{ name: string; price: number }> = [];
    $section.find('.option').each((_, optionEl) => {
      const $option = $(optionEl);

      // Get modifier name
      let name = $option.find('.modifierText, .modifierTextContent').first().text().trim();
      if (!name) {
        name = $option.find('label').text().replace(/\+?\$[\d.]+/g, '').trim();
      }
      name = name.replace(/\+?\$[\d.]+/g, '').replace(/\s+/g, ' ').trim();

      if (!name || name.length < 2 || name.length > 80 || seenOptions.has(name)) return;
      const lower = name.toLowerCase();
      if (lower.includes('add to') || lower.includes('cart') || lower.includes('quantity') ||
          lower.includes('special instruction') || lower.includes('subscribe') ||
          lower.includes('marketing') || name === itemName) return;

      // Get price
      let price = 0;
      const optionText = $option.text();
      const priceMatch = optionText.match(/\+?\$(\d+\.?\d*)/);
      if (priceMatch) price = parseFloat(priceMatch[1]);

      seenOptions.add(name);
      options.push({ name, price });
      flatModifiers.push({ name, price, groupName });
    });

    if (options.length > 0) {
      groups.push({
        name: groupName,
        required: isRequired,
        minSelections,
        maxSelections,
        options
      });
    }
  });

  return { modifierGroups: groups, flatModifiers };
}

export async function scrapeMenu(restaurantUrl: string, options?: { skipModifiers?: boolean }): Promise<ScrapedMenu> {
  const startedAt = Date.now();
  const skipModifiers = options?.skipModifiers ?? false;
  const telemetry: FetchTelemetryContext = {
    cfDetected: false,
    unlockerUsed: false,
  };
  let stage = 'init';
  let failReason: string | undefined;
  let platform: OrderingPlatform | null = null;

  console.log(`Scraping menu from ${restaurantUrl}...`);

  try {
    platform = detectOrderingPlatform(restaurantUrl);
    if (!platform) {
      throw new Error("Unsupported menu URL. Expected Toast or ChowNow ordering URL.");
    }

    if (platform === "chownow") {
      stage = "chownow_playwright";
      const menu = await scrapeChowNowMenuWithPlaywright(
        restaurantUrl,
        { skipModifiers },
        telemetry,
      );

      logBotRunTelemetry({
        runType: "menu-scrape",
        success: true,
        stage,
        cfDetected: telemetry.cfDetected,
        proxyUsed: Boolean(getScraperProxyUrl()),
        unlockerUsed: telemetry.unlockerUsed,
        durationMs: Date.now() - startedAt,
        metadata: {
          url: restaurantUrl,
          platform,
          itemCount: menu.items.length,
        },
      });

      return menu;
    }

    // Toast: Fetch the main menu page with fallback strategy (Web Unlocker -> Playwright proxy)
    stage = 'fetch_menu_html';
    const html = await fetchMenuHtmlResilient(restaurantUrl, telemetry);
    const $ = cheerio.load(html);

    // Get restaurant name
    stage = 'parse_restaurant';
    const restaurantName = $('h1').first().text().trim() || $('title').text().split('|')[0]?.trim() || 'Restaurant';
    console.log(`  Restaurant: ${restaurantName}`);

    // Get page text for address/ETA extraction
    const pageText = $('body').text();

    // Extract address
    const address = extractAddress(pageText);
    if (address?.addressLine1) {
      console.log(`  Address: ${address.addressLine1}, ${address.city || ''}, ${address.state || ''}`);
    }

    // Extract delivery ETA
    const deliveryEta = extractDeliveryEta(pageText);
    if (deliveryEta) {
      console.log(`  Delivery ETA: ${deliveryEta}`);
    }

    // Get hero image
    let heroImage: string | undefined;
    $('img').each((_, img) => {
      const src = $(img).attr('src') || '';
      if (src.includes('cloudinary') && !src.includes('logo')) {
        heroImage = src;
        return false; // break
      }
    });

    // Get menu items
    stage = 'parse_menu_items';
    const items: MenuItem[] = [];
    let currentCategory = 'Menu';

    $('[data-testid="menu-item-card"], li.item, [class*="menuItem"]').each((index, el) => {
      const $item = $(el);

      // Try to find category from parent group
      const $group = $item.closest('[data-testid^="menu-group-"], [class*="menuGroup"]');
      if ($group.length) {
        const header = $group.find('h2, h3, [class*="categoryHeader"]').first().text().trim();
        if (header) currentCategory = header;
      }

      const name = $item.find('.itemName, [class*="itemName"], h3, h4, strong').first().text().trim();
      const description = $item.find('.itemDescription, [class*="itemDescription"], p').first().text().trim();
      const priceText = $item.find('.itemPrice, [class*="itemPrice"], [class*="price"]').first().text().trim();
      const image = $item.find('img').first().attr('src');

      if (name && name.length > 0) {
        const priceMatch = priceText.match(/[\d.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

        items.push({
          id: `item-${index}`,
          name,
          description,
          price,
          category: currentCategory,
          image: image || undefined,
          modifiers: []
        });
      }
    });

    console.log(`  Found ${items.length} menu items`);
    if (items.length === 0) {
      throw new Error('No menu items were parsed from Toast. Blocking rules or DOM structure likely changed.');
    }

    // Scrape modifiers by fetching each item's detail page
    if (!skipModifiers && items.length > 0) {
      stage = 'parse_modifiers';
      console.log(`Scraping modifiers for up to 25 items...`);
      let itemsWithModifiers = 0;

      // Get item detail URLs from the page
      const itemLinks: string[] = [];
      $('[data-testid="menu-item-card"] a, li.item a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          // Convert relative URLs to absolute
          const fullUrl = href.startsWith('http') ? href : `https://www.toasttab.com${href}`;
          itemLinks.push(fullUrl);
        }
      });

      for (let i = 0; i < Math.min(items.length, 25); i++) {
        const item = items[i];
        if (!item) continue;

        try {
          // Try to find a link for this item
          const itemUrl = itemLinks[i];
          if (!itemUrl) {
            // Toast URLs have item GUIDs, skip items without direct links
            continue;
          }

          console.log(`  Fetching modifiers for: ${item.name}`);
          const itemHtml = await fetchWithWebUnlocker(itemUrl, telemetry);
          if (isCloudflareBlockedHtml(itemHtml)) {
            telemetry.cfDetected = true;
            throw new Error('Modifier page returned Cloudflare challenge');
          }
          const $item = cheerio.load(itemHtml);

          const { modifierGroups, flatModifiers } = parseModifiers($item, item.name);

          if (flatModifiers.length > 0) {
            item.modifiers = flatModifiers;
            item.modifierGroups = modifierGroups;
            itemsWithModifiers++;
            const requiredGroups = modifierGroups.filter(g => g.required).length;
            console.log(`    ${flatModifiers.length} modifiers in ${modifierGroups.length} groups (${requiredGroups} required)`);
          }

          // Small delay to avoid rate limiting
          await delay(500);
        } catch (e) {
          console.log(`    Error fetching modifiers for ${item.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      console.log(`Modifier scraping complete: ${itemsWithModifiers} items had modifiers`);
    }

    // Extract slug from URL
    stage = 'finalize';
    const slugMatch = restaurantUrl.match(/\/order\/([^\\/\\?]+)/);
    const restaurantSlug = slugMatch ? slugMatch[1] : 'unknown';

    // Get unique categories
    const uniqueCategories = [...new Set(items.map(i => i.category))];

    const menu: ScrapedMenu = {
      restaurantName,
      restaurantSlug,
      url: restaurantUrl,
      items,
      categories: uniqueCategories.length > 0 ? uniqueCategories : ['Menu'],
      scrapedAt: new Date().toISOString(),
      heroImage,
      address,
      deliveryEta,
    };

    console.log(`Scraped ${items.length} items from ${menu.restaurantName}`);
    console.log(`Categories: ${menu.categories.join(', ')}`);

    logBotRunTelemetry({
      runType: 'menu-scrape',
      success: true,
      stage,
      cfDetected: telemetry.cfDetected,
      proxyUsed: Boolean(getScraperProxyUrl()),
      unlockerUsed: telemetry.unlockerUsed,
      durationMs: Date.now() - startedAt,
      metadata: {
        url: restaurantUrl,
        itemCount: items.length,
        platform,
      },
    });

    return menu;
  } catch (error) {
    failReason = error instanceof Error ? error.message : String(error);
    logBotRunTelemetry({
      runType: 'menu-scrape',
      success: false,
      stage,
      cfDetected: telemetry.cfDetected,
      proxyUsed: Boolean(getScraperProxyUrl()),
      unlockerUsed: telemetry.unlockerUsed,
      durationMs: Date.now() - startedAt,
      failReason,
      metadata: {
        url: restaurantUrl,
      },
    });
    throw error;
  }
}
