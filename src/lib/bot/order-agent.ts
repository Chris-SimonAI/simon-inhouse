import { chromium, type Page } from 'playwright';
import {
  applyAutomationInitScript,
  BOT_USER_AGENT,
  buildChromiumLaunchOptions,
  delay,
  ensureNoCloudflareBlock,
  getScraperProxyUrl,
} from '@/lib/bot/browser-automation';
import { logBotRunTelemetry } from '@/lib/bot/bot-telemetry';

export interface OrderItem {
  name: string;
  quantity: number;
  modifiers?: string[];
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  apt?: string;
}

export interface PaymentInfo {
  cardNumber: string;
  expiry: string;
  cvv: string;
  zip: string;
}

export interface OrderRequest {
  restaurantUrl: string;
  items: OrderItem[];
  customer: CustomerInfo;
  payment: PaymentInfo;
  orderType: 'pickup' | 'delivery';
  deliveryAddress?: DeliveryAddress;
  dryRun?: boolean;
  orderTotal?: number;
}

export interface ConfirmationData {
  confirmationNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  orderTotal?: number;
}

export interface OrderResult {
  success: boolean;
  message: string;
  orderId?: string;
  stage?: string;
  confirmation?: ConfirmationData;
}

// Test card that will be declined
const TEST_CARD = '4000000000000002';
const ORDER_PAGE_LOAD_MAX_ATTEMPTS = 3;

type CartState = {
  count: number | null;
  hasActionCta: boolean;
};

async function navigateToRestaurantPage(page: Page, url: string): Promise<boolean> {
  let lastError = 'Unknown navigation error';

  for (let attempt = 1; attempt <= ORDER_PAGE_LOAD_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`  Navigation attempt ${attempt}/${ORDER_PAGE_LOAD_MAX_ATTEMPTS}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await delay(2500);
      return await ensureNoCloudflareBlock(page, `page_load_attempt_${attempt}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`  Navigation attempt ${attempt} failed: ${lastError}`);
      if (attempt < ORDER_PAGE_LOAD_MAX_ATTEMPTS) {
        await delay(attempt * 1500);
      }
    }
  }

  throw new Error(`Failed to load Toast page after retries: ${lastError}`);
}

async function getToastCartState(page: Page): Promise<CartState> {
  return page.evaluate(() => {
    const actionNodes = Array.from(
      document.querySelectorAll(
        'button.targetAction, [class*="targetAction"], [data-testid*="cart"], [data-testid*="order-summary"]',
      ),
    ) as HTMLElement[];

    let parsedCount: number | null = null;
    for (const node of actionNodes) {
      const text = node.innerText?.trim() || '';
      const exactCount = text.match(/^\d+$/);
      if (exactCount) {
        parsedCount = Number(exactCount[0]);
        break;
      }

      const labeledCount = text.match(/(?:cart|order)\D*(\d+)/i);
      if (labeledCount) {
        parsedCount = Number(labeledCount[1]);
        break;
      }
    }

    const hasActionCta = Array.from(document.querySelectorAll('button, a')).some((node) => {
      const text = (node as HTMLElement).innerText?.toLowerCase().trim() || '';
      return text.includes('view order') || text.includes('checkout') || text.includes('review order');
    });

    return {
      count: parsedCount,
      hasActionCta,
    };
  });
}

function hasCartAdvanced(before: CartState, after: CartState): boolean {
  if (before.count !== null && after.count !== null) {
    return after.count > before.count;
  }

  if (before.count === 0 && after.count === null) {
    return after.hasActionCta;
  }

  if (!before.hasActionCta && after.hasActionCta) {
    return true;
  }

  return false;
}

async function waitForCartAdvance(page: Page, before: CartState, timeoutMs: number): Promise<CartState> {
  const startedAt = Date.now();
  let latest = await getToastCartState(page);

  while (Date.now() - startedAt < timeoutMs) {
    if (hasCartAdvanced(before, latest)) {
      return latest;
    }

    await page.waitForTimeout(400);
    latest = await getToastCartState(page);
  }

  return latest;
}

function escapeForSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function openItemEditor(page: Page, itemName: string): Promise<void> {
  const escapedName = escapeForSelector(itemName);
  const selectors = [
    `[data-testid="menu-item-card"]:has-text("${escapedName}")`,
    `li:has-text("${escapedName}")`,
    `a:has-text("${escapedName}")`,
    `button:has-text("${escapedName}")`,
    `span:has-text("${escapedName}")`,
  ];

  for (const selector of selectors) {
    const target = page.locator(selector).first();
    const visible = await target.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      continue;
    }

    await target.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const ctaAttached = await page
      .waitForSelector('[data-testid="menu-item-cart-cta"]', { state: 'attached', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (ctaAttached) {
      return;
    }

    if (page.url().includes('/item-')) {
      await page.waitForTimeout(1200);
      const ctaRetryCount = await page.locator('[data-testid="menu-item-cart-cta"]').count().catch(() => 0);
      if (ctaRetryCount > 0) {
        return;
      }
    }
  }

  const fallback = await page.evaluate((targetName) => {
    const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const target = normalize(targetName);

    const matchingAnchor = Array.from(document.querySelectorAll('a[href*="/item-"]')).find((anchor) => {
      const text = normalize((anchor as HTMLElement).innerText || anchor.textContent || '');
      return text.includes(target);
    }) as HTMLAnchorElement | undefined;

    if (matchingAnchor?.href) {
      return { action: 'navigate', href: matchingAnchor.href };
    }

    const cardCandidates = Array.from(document.querySelectorAll('[data-testid="menu-item-card"], li, article'));
    for (const card of cardCandidates) {
      const text = normalize((card as HTMLElement).innerText || '');
      if (!text.includes(target)) {
        continue;
      }

      const nestedAnchor = card.querySelector('a[href*="/item-"]') as HTMLAnchorElement | null;
      if (nestedAnchor?.href) {
        return { action: 'navigate', href: nestedAnchor.href };
      }

      (card as HTMLElement).click();
      return { action: 'clicked' };
    }

    return null;
  }, itemName);

  if (fallback?.action === 'navigate' && fallback.href) {
    await page.goto(fallback.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const ctaAttached = await page
      .waitForSelector('[data-testid="menu-item-cart-cta"]', { state: 'attached', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ctaAttached) {
      return;
    }
  }

  if (fallback?.action === 'clicked') {
    const ctaAttached = await page
      .waitForSelector('[data-testid="menu-item-cart-cta"]', { state: 'attached', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ctaAttached) {
      return;
    }
  }

  throw new Error(`Unable to open item editor for "${itemName}"`);
}

async function resolveFulfillmentPrompts(page: Page): Promise<string[]> {
  const clickedButtons: string[] = [];

  for (let attempt = 0; attempt < 6; attempt++) {
    const clickedText = await page.evaluate(() => {
      const promptKeywords = [
        'schedule your order for later',
        'schedule order',
        'start order',
        'as soon as possible',
        'asap',
        'select time',
        'choose time',
        'continue',
        'save',
        'confirm',
        'done',
        'next',
      ];

      const nodes = Array.from(document.querySelectorAll('button, a')) as HTMLButtonElement[];
      for (const node of nodes) {
        const text = node.textContent?.toLowerCase().trim() || '';
        if (!text) {
          continue;
        }
        if (text.includes('sign in')) {
          continue;
        }
        if (!promptKeywords.some((keyword) => text.includes(keyword))) {
          continue;
        }

        const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
        if (disabled) {
          continue;
        }

        const style = window.getComputedStyle(node);
        const hidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        if (hidden) {
          continue;
        }

        node.scrollIntoView({ block: 'center' });
        node.click();
        return text;
      }

      return null;
    });

    if (!clickedText) {
      break;
    }

    clickedButtons.push(clickedText);
    await page.waitForTimeout(1400);
  }

  return clickedButtons;
}

// Scrape confirmation page for order details
async function scrapeConfirmationPage(page: Page): Promise<ConfirmationData> {
  const confirmation: ConfirmationData = {};

  try {
    await page.waitForSelector('text=/thank you|order confirmed|confirmation/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Extract order/confirmation number
    const confirmationNumber = await page.evaluate(() => {
      const patterns = [
        /order\s*#?\s*([A-Z0-9-]+)/i,
        /confirmation\s*#?\s*:?\s*([A-Z0-9-]+)/i,
        /reference\s*#?\s*:?\s*([A-Z0-9-]+)/i,
        /#([A-Z0-9-]{4,})/i
      ];

      const text = document.body.innerText;
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      const orderNumEl = document.querySelector('[class*="order-number"], [class*="orderNumber"], [class*="confirmation-number"], [data-testid*="order"]');
      if (orderNumEl) {
        const numMatch = orderNumEl.textContent?.match(/([A-Z0-9-]{4,})/i);
        if (numMatch) return numMatch[1];
      }

      return null;
    });

    if (confirmationNumber) {
      confirmation.confirmationNumber = confirmationNumber;
      console.log(`  Found confirmation number: ${confirmationNumber}`);
    }

    // Extract tracking URL
    const trackingUrl = await page.evaluate(() => {
      const trackingKeywords = ['track', 'status', 'delivery', 'doordash', 'ubereats', 'grubhub', 'postmates'];
      const links = Array.from(document.querySelectorAll('a[href]'));

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.toLowerCase() || '';

        for (const keyword of trackingKeywords) {
          if (href.toLowerCase().includes(keyword) || text.includes(keyword)) {
            if (href.startsWith('http')) {
              return href;
            } else if (href.startsWith('/')) {
              return window.location.origin + href;
            }
          }
        }
      }

      const trackBtns = document.querySelectorAll('button, a');
      for (const btn of trackBtns) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('track') || text.includes('status')) {
          const onclick = btn.getAttribute('onclick') || '';
          const urlMatch = onclick.match(/https?:\/\/[^\s'"]+/);
          if (urlMatch) return urlMatch[0];
        }
      }

      return null;
    });

    if (trackingUrl) {
      confirmation.trackingUrl = trackingUrl;
      console.log(`  Found tracking URL: ${trackingUrl}`);
    }

    // Extract estimated delivery time
    const estimatedDelivery = await page.evaluate(() => {
      const timePatterns = [
        /(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
        /(\d{1,2}\s*-\s*\d{1,2}\s*(?:min|minutes?))/i,
        /(?:ready|arrive|delivery)\s*(?:by|at|in)?\s*:?\s*(\d{1,2}:\d{2}|\d{1,2}\s*(?:min|minutes?))/i,
        /(?:eta|estimated)\s*:?\s*(\d{1,2}:\d{2}|\d{1,2}\s*-?\s*\d{0,2}\s*(?:min|minutes?))/i
      ];

      const text = document.body.innerText;
      for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      const etaEl = document.querySelector('[class*="eta"], [class*="delivery-time"], [class*="estimated"], [class*="ready-time"]');
      if (etaEl && etaEl.textContent) {
        return etaEl.textContent.trim();
      }

      return null;
    });

    if (estimatedDelivery) {
      confirmation.estimatedDelivery = estimatedDelivery;
      console.log(`  Found estimated delivery: ${estimatedDelivery}`);
    }

    // Extract order total from confirmation page
    const orderTotal = await page.evaluate(() => {
      const totalPatterns = [
        /total\s*:?\s*\$?([\d.]+)/i,
        /amount\s*:?\s*\$?([\d.]+)/i,
        /charged\s*:?\s*\$?([\d.]+)/i
      ];

      const text = document.body.innerText;
      for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (amount > 0 && amount < 1000) {
            return amount;
          }
        }
      }

      const totalEl = document.querySelector('[class*="total"], [class*="amount"], [data-testid*="total"]');
      if (totalEl) {
        const numMatch = totalEl.textContent?.match(/\$?([\d.]+)/);
        if (numMatch) {
          const amount = parseFloat(numMatch[1]);
          if (amount > 0 && amount < 1000) return amount;
        }
      }

      return null;
    });

    if (orderTotal) {
      confirmation.orderTotal = orderTotal;
      console.log(`  Found order total: $${orderTotal}`);
    }

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  Warning: Error scraping confirmation: ${msg}`);
  }

  return confirmation;
}

export async function placeToastOrder(request: OrderRequest): Promise<OrderResult> {
  const startedAt = Date.now();
  let currentStage = 'init';
  let cfDetected = false;
  let failReason: string | undefined;
  let didSucceed = false;

  const finish = (result: OrderResult, reason?: string): OrderResult => {
    didSucceed = result.success;
    failReason = reason;
    return result;
  };

  // Use residential proxy if configured (bypasses Cloudflare)
  const proxyUrl = getScraperProxyUrl();
  const launchOptions = buildChromiumLaunchOptions(proxyUrl);

  if (proxyUrl) {
    console.log('  Using residential proxy for ordering');
  } else {
    console.log('  Warning: SCRAPER_PROXY_URL is not configured; Cloudflare pass rate may be low.');
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    userAgent: BOT_USER_AGENT,
    ignoreHTTPSErrors: !!proxyUrl, // Required for proxy SSL interception
  });

  await applyAutomationInitScript(context);

  const page = await context.newPage();

  try {
    console.log('=== Toast Order Agent ===');
    console.log(`Restaurant: ${request.restaurantUrl}`);
    console.log(`Items: ${request.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);

    // Step 1: Navigate to restaurant
    currentStage = 'page_load';
    console.log('\nStep 1: Loading restaurant page...');
    cfDetected = cfDetected || (await navigateToRestaurantPage(page, request.restaurantUrl));

    // Dismiss any popups
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);

    // Wait for Toast menu items to render (SPA needs time)
    console.log('  Waiting for menu items to render...');
    try {
      await page.waitForSelector('[data-testid="menu-item-card"], li.item, [class*="menuItem"]', { timeout: 30000 });
      console.log('  Menu items found');
    } catch {
      console.log('  Warning: Menu item selectors not found, continuing anyway...');
      await page.waitForTimeout(5000);
    }
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, 'menu_render'));

    // Step 1b: Select order type and enter delivery address (Toast requires this before adding items)
    console.log(`  Selecting order type: ${request.orderType}...`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(800);

    // Debug: capture what fulfillment elements are on the page
    let fulfillmentDebug: Array<{
      tag: string;
      text: string;
      class: string;
      testId: string;
      role: string;
    }> = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        fulfillmentDebug = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, [role="tab"]')).slice(0, 40).map(el => ({
            tag: el.tagName,
            text: (el as HTMLElement).innerText?.trim().slice(0, 60) || '',
            class: el.className?.toString().slice(0, 60) || '',
            testId: el.getAttribute('data-testid') || '',
            role: el.getAttribute('role') || '',
          }));
          return buttons.filter(b => b.text);
        });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 3 || !message.toLowerCase().includes('execution context was destroyed')) {
          throw error;
        }
        console.log(`  Fulfillment debug retry ${attempt}/3 after navigation race...`);
        await page.waitForTimeout(1200);
      }
    }
    console.log('  Page elements:', JSON.stringify(fulfillmentDebug, null, 2));

    // Try fulfillment selectors (Toast uses .option class for Delivery/Pickup)
    const orderTypeSelectors = request.orderType === 'delivery'
      ? [
          '.option:has-text("Delivery")', 'text="Delivery"',
          'button:has-text("Delivery")', '[role="tab"]:has-text("Delivery")',
          'a:has-text("Delivery")', '[data-testid*="delivery"]',
        ]
      : [
          '.option:has-text("Pickup")', 'text="Pickup"',
          'button:has-text("Pickup")', '[role="tab"]:has-text("Pickup")',
          'button:has-text("Pick up")', '[data-testid*="pickup"]',
        ];

    let orderTypeSelected = false;
    for (const selector of orderTypeSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.click();
        console.log(`  Selected order type via: ${selector}`);
        orderTypeSelected = true;
        await page.waitForTimeout(2000);
        break;
      }
    }

    if (!orderTypeSelected) {
      console.log('  No order type selector found, trying to click fulfillment area...');
      // Toast sometimes has a fulfillment bar you need to click to open the selector
      const fulfillmentBar = page.locator('[class*="fulfillment"], [class*="orderType"], [data-testid*="fulfillment"]').first();
      if (await fulfillmentBar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fulfillmentBar.click();
        console.log('  Clicked fulfillment bar');
        await page.waitForTimeout(2000);
        // Now try again to find delivery/pickup
        for (const selector of orderTypeSelectors) {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            await el.click();
            console.log(`  Selected order type via: ${selector}`);
            orderTypeSelected = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      }
    }

    // If delivery, enter address now (Toast requires address before menu is enabled)
    if (request.orderType === 'delivery' && request.deliveryAddress) {
      console.log('  Entering delivery address upfront...');
      const fullAddress = `${request.deliveryAddress.street}, ${request.deliveryAddress.city}, ${request.deliveryAddress.state} ${request.deliveryAddress.zip}`;

      const addressSelectors = [
        'input[placeholder*="address" i]',
        'input[placeholder*="Address" i]',
        'input[placeholder*="Enter delivery" i]',
        'input[name*="address" i]',
        'input[data-testid*="address"]',
        'input[aria-label*="address" i]',
        'input[type="search"]',
      ];

      for (const selector of addressSelectors) {
        const addressInput = page.locator(selector).first();
        if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addressInput.click();
          await addressInput.fill(fullAddress);
          console.log(`  Entered address via: ${selector}`);
          await page.waitForTimeout(2000);

          // Select first autocomplete suggestion
          const suggestion = page.locator('[class*="suggestion"], [class*="autocomplete"] li, [role="option"], [class*="pac-item"]').first();
          if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
            await suggestion.click();
            console.log('  Selected address suggestion');
            await page.waitForTimeout(1500);
          }
          break;
        }
      }

      // Confirm address / start order
      const confirmSelectors = [
        'button:has-text("Start Order")',
        'button:has-text("Confirm")',
        'button:has-text("Continue")',
        'button:has-text("Save")',
        'button:has-text("ASAP")',
        '[data-testid*="fulfill-cta"]',
        '[data-testid*="start-order"]',
      ];
      for (const selector of confirmSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click();
          console.log(`  Confirmed via: ${selector}`);
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    // Dismiss any remaining modals
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, 'before_add_to_cart'));
    const fulfillmentClicks = await resolveFulfillmentPrompts(page);
    if (fulfillmentClicks.length > 0) {
      console.log(`  Fulfillment prompts resolved: ${fulfillmentClicks.join(' -> ')}`);
      await page.waitForTimeout(1200);
    }

    // Step 2: Add items to cart
    currentStage = 'add_to_cart';
    console.log('\nStep 2: Adding items to cart...');
    for (const item of request.items) {
      console.log(`  Looking for "${item.name}"...`);
      const cartBeforeAdd = await getToastCartState(page);
      console.log(`  Cart before add: count=${cartBeforeAdd.count ?? 'unknown'} cta=${cartBeforeAdd.hasActionCta}`);

      let addCtaAttached = false;
      for (let openAttempt = 1; openAttempt <= 3; openAttempt++) {
        await openItemEditor(page, item.name);
        console.log(`  Opened item editor for ${item.name} (attempt ${openAttempt})`);
        const openFulfillmentClicks = await resolveFulfillmentPrompts(page);
        if (openFulfillmentClicks.length > 0) {
          console.log(`  Fulfillment clicks while opening item: ${openFulfillmentClicks.join(' -> ')}`);
        }

        addCtaAttached = await page
          .waitForSelector('[data-testid="menu-item-cart-cta"]', { state: 'attached', timeout: 7000 })
          .then(() => true)
          .catch(() => false);
        if (addCtaAttached) {
          break;
        }

        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(800);
      }

      if (!addCtaAttached) {
        throw new Error(`Add to Cart CTA not visible after opening "${item.name}"`);
      }

      // Handle modifiers if specified
      if (item.modifiers && item.modifiers.length > 0) {
        console.log(`  Selecting ${item.modifiers.length} modifiers...`);
        for (const rawModifier of item.modifiers) {
          // Strip category prefix if present (e.g., "Selection Required-Buffalo" -> "Buffalo")
          const dashIndex = rawModifier.indexOf('-');
          const modifier = dashIndex > -1 ? rawModifier.substring(dashIndex + 1) : rawModifier;
          console.log(`    Looking for: "${modifier}"`);

          // Check if this modifier is already selected
          const isAlreadySelected = await page.evaluate((modName) => {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
              if (label.textContent?.includes(modName)) {
                const input = label.querySelector('input') || document.getElementById(label.getAttribute('for') || '');
                if (input && (input as HTMLInputElement).checked) {
                  return true;
                }
              }
            }
            return false;
          }, modifier);

          if (isAlreadySelected) {
            console.log(`    Already selected: ${modifier}`);
            continue;
          }

          const selectors = [
            `label:has-text("${modifier}")`,
            `text="${modifier}"`,
            `span:has-text("${modifier}")`,
          ];

          let found = false;
          for (const selector of selectors) {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
              await el.click();
              console.log(`    Selected: ${modifier}`);
              await page.waitForTimeout(300);
              found = true;
              break;
            }
          }
          if (!found) {
            console.log(`    Warning: Modifier not found: ${modifier}`);
          }
        }
      }

      // Handle required modifier groups - auto-select first option if needed
      const addBtn = page.locator('[data-testid="menu-item-cart-cta"], button:has-text("Add")').first();
      const isDisabled = await addBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);

      if (isDisabled) {
        console.log(`  Add button disabled - checking for required modifiers...`);

        // Toast uses .modSection with "Required" text in section titles.
        // Click both labels and inputs so React state updates reliably.
        const requiredSelection = await page.evaluate(() => {
          const selectedGroups: string[] = [];
          const unresolvedGroups: string[] = [];

          const sections = Array.from(document.querySelectorAll('.modSection, [role="group"], fieldset'));
          sections.forEach((section) => {
            const titleContainer = section.querySelector('.modSectionTitleContainer, legend, [class*="title"]');
            const titleText = titleContainer?.textContent || '';
            const isRequired = /required/i.test(titleText);

            if (!isRequired) {
              return;
            }

            const groupName =
              section.querySelector('.modSectionTitle, [class*="sectionTitle"]')?.textContent?.trim() || 'Unknown';

            const hasChecked = section.querySelector('input:checked') !== null;
            if (hasChecked) {
              selectedGroups.push(groupName);
              return;
            }

            const optionCandidates = Array.from(
              section.querySelectorAll('label, .option, [role="radio"], [role="checkbox"]'),
            ) as HTMLElement[];
            const pricedOption =
              optionCandidates.find((candidate) =>
                /\$\s*[1-9]\d*(?:\.\d{1,2})?/i.test(candidate.textContent || ''),
              ) || null;
            const firstLabel = pricedOption || optionCandidates[0] || null;
            if (firstLabel) {
              firstLabel.scrollIntoView({ block: 'center' });
              firstLabel.click();
            }

            const firstInput = section.querySelector('input[type="radio"], input[type="checkbox"]') as HTMLInputElement | null;
            if (firstInput) {
              firstInput.scrollIntoView({ block: 'center' });
              if (!firstInput.checked) {
                firstInput.click();
              }
              firstInput.dispatchEvent(new Event('input', { bubbles: true }));
              firstInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const nowChecked = section.querySelector('input:checked') !== null;
            if (nowChecked) {
              selectedGroups.push(groupName);
            } else {
              unresolvedGroups.push(groupName);
            }
          });

          const btn = document.querySelector('[data-testid="menu-item-cart-cta"]') as HTMLButtonElement | null;
          return {
            selectedGroups,
            unresolvedGroups,
            buttonDisabled: btn?.disabled ?? true,
          };
        });

        console.log(
          `  Required selection result: selected=${requiredSelection.selectedGroups.length}, unresolved=${requiredSelection.unresolvedGroups.length}`,
        );

        // Fallback: click any unchecked radio/checkbox in required groups via DOM
        const stillDisabledAfter = await addBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);
        if (stillDisabledAfter) {
          console.log('  Still disabled, trying fallback via DOM click...');
          await page.evaluate(() => {
            // Find all required sections and click first unchecked input in each
            const sections = document.querySelectorAll('.modSection');
            sections.forEach(section => {
              const titleText = section.querySelector('.modSectionTitleContainer')?.textContent || '';
              if (/required/i.test(titleText) && !section.querySelector('input:checked')) {
                const optionCandidates = Array.from(section.querySelectorAll('label, .option')) as HTMLElement[];
                const pricedOption =
                  optionCandidates.find((candidate) =>
                    /\$\s*[1-9]\d*(?:\.\d{1,2})?/i.test(candidate.textContent || ''),
                  ) || null;
                const label = pricedOption || optionCandidates[0] || null;
                if (label) {
                  label.scrollIntoView({ block: 'center' });
                  label.click();
                }
                const firstInput = section.querySelector('input[type="radio"], input[type="checkbox"]') as HTMLInputElement;
                if (firstInput) {
                  firstInput.scrollIntoView({ block: 'center' });
                  firstInput.click();
                  firstInput.dispatchEvent(new Event('input', { bubbles: true }));
                  firstInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            });
          });
          await page.waitForTimeout(500);
        }

        await page.waitForTimeout(500);
      }

      // Click Add to Cart button (retry if still disabled)
      for (let attempt = 0; attempt < 3; attempt++) {
        const stillDisabled = await addBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);
        if (!stillDisabled) break;

        console.log(`  Attempt ${attempt + 1}: Add still disabled, clicking first available option...`);
        await page.evaluate(() => {
          const input = document.querySelector('.modSection input:not(:checked)') as HTMLInputElement;
          if (input) {
            input.scrollIntoView({ block: 'center' });
            input.click();
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        await page.waitForTimeout(500);
      }

      // Wait for React to settle after modifier selection
      await page.waitForTimeout(1500);

      // Click Add button using Playwright (not DOM) to trigger React event handlers
      // Use a fresh locator each attempt to avoid stale references from React re-renders
      let addSuccess = false;
      for (let addAttempt = 0; addAttempt < 5; addAttempt++) {
        const freshBtn = page.locator('[data-testid="menu-item-cart-cta"]').first();
        const btnDisabled = await freshBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => true);

        if (!btnDisabled) {
          await freshBtn.click({ force: true, timeout: 5000 }).catch(() => {});
          console.log(`  Clicked Add button (attempt ${addAttempt + 1})`);
          addSuccess = true;
          break;
        }

        console.log(`  Add button still disabled (attempt ${addAttempt + 1}), waiting...`);
        await page.waitForTimeout(1000);
      }

      if (!addSuccess) {
        // Recovery: if all required groups are selected but CTA is still disabled, force a final click.
        const forcedClickResult = await page.evaluate(() => {
          const requiredSections = Array.from(document.querySelectorAll('.modSection')).filter((section) => {
            const titleText = section.querySelector('.modSectionTitleContainer')?.textContent || '';
            return /required/i.test(titleText);
          });
          const unresolvedRequired = requiredSections.filter(
            (section) => section.querySelector('input:checked') === null,
          ).length;

          const btn = document.querySelector('[data-testid="menu-item-cart-cta"]') as HTMLButtonElement | null;
          if (!btn) {
            return { forced: false, reason: 'btn_not_found', unresolvedRequired };
          }
          if (unresolvedRequired > 0) {
            return { forced: false, reason: 'required_unresolved', unresolvedRequired };
          }

          if (btn.disabled) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
          }

          btn.click();
          return { forced: true, reason: 'forced_click', unresolvedRequired };
        });

        if (forcedClickResult.forced) {
          console.log(`  Forced Add click after disabled-state mismatch`);
          addSuccess = true;
          await page.waitForTimeout(1500);
        }
      }

      if (!addSuccess) {
        // Recovery: Toast may block Add until fulfillment time/start-order confirmation is clicked.
        const fulfillmentRecovery = await page.evaluate(() => {
          const keywords = ['asap', 'continue', 'start order', 'save', 'confirm', 'select time', 'next'];
          const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
          for (const button of buttons) {
            const text = button.textContent?.toLowerCase().trim() || '';
            if (!text || button.disabled) {
              continue;
            }
            if (keywords.some((keyword) => text.includes(keyword))) {
              button.scrollIntoView({ block: 'center' });
              button.click();
              return text;
            }
          }
          return null;
        });

        if (fulfillmentRecovery) {
          console.log(`  Fulfillment recovery click: ${fulfillmentRecovery}`);
          await page.waitForTimeout(2000);
          const postRecoveryBtn = page.locator('[data-testid="menu-item-cart-cta"]').first();
          const postRecoveryDisabled = await postRecoveryBtn
            .evaluate((el) => (el as HTMLButtonElement).disabled)
            .catch(() => true);
          if (!postRecoveryDisabled) {
            await postRecoveryBtn.click({ force: true, timeout: 5000 }).catch(() => {});
            addSuccess = true;
            console.log('  Add succeeded after fulfillment recovery');
            await page.waitForTimeout(1500);
          }
        }
      }

      if (!addSuccess) {
        // Last recovery: fire low-level pointer events to ensure React handlers run.
        const lowLevelClicked = await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="menu-item-cart-cta"]') as HTMLButtonElement | null;
          if (!btn) {
            return false;
          }
          if (btn.disabled) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
          }
          btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return true;
        });
        if (lowLevelClicked) {
          console.log('  Add recovery via low-level click events');
          addSuccess = true;
          await page.waitForTimeout(1500);
        }
      }

      if (!addSuccess) {
        // Capture diagnostic info
        const diagInfo = await page.evaluate(() => {
          const selectedOption = document.querySelector('.option.selected')?.textContent?.trim() || 'none';
          const btn = document.querySelector('[data-testid="menu-item-cart-cta"]') as HTMLButtonElement;
          const btnText = btn?.textContent?.trim() || 'not found';
          const btnDisabled = btn?.disabled ?? true;
          const modSections = Array.from(document.querySelectorAll('.modSection')).map(s => {
            const title = s.querySelector('.modSectionTitleContainer')?.textContent?.trim() || '';
            const hasChecked = !!s.querySelector('input:checked');
            const inputCount = s.querySelectorAll('input').length;
            return { title, hasChecked, inputCount };
          });
          const addressInputs = Array.from(document.querySelectorAll('input')).filter(i =>
            i.placeholder?.toLowerCase().includes('address') || i.name?.toLowerCase().includes('address')
          ).map(i => ({ placeholder: i.placeholder, value: i.value, visible: i.offsetParent !== null }));
          return { selectedOption, btnText, btnDisabled, modSections, addressInputs };
        });
        throw new Error(`Add to Cart button remained disabled. Debug: ${JSON.stringify(diagInfo)}`);
      }
      await page.waitForTimeout(1200);

      // Verify add actually changed the cart state; if not, retry the CTA once.
      let cartAfterAdd = await waitForCartAdvance(page, cartBeforeAdd, 6000);
      if (!hasCartAdvanced(cartBeforeAdd, cartAfterAdd)) {
        console.log('  Cart did not advance after add click, retrying CTA once...');
        const retryClicked = await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="menu-item-cart-cta"]') as HTMLButtonElement | null;
          if (!btn) {
            return false;
          }
          if (btn.disabled) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
          }
          btn.click();
          return true;
        });

        if (retryClicked) {
          await page.waitForTimeout(1200);
          cartAfterAdd = await waitForCartAdvance(page, cartBeforeAdd, 5000);
        }
      }

      if (!hasCartAdvanced(cartBeforeAdd, cartAfterAdd)) {
        console.log('  Cart still unchanged, resolving fulfillment prompts and retrying item add...');
        const retryFulfillmentClicks = await resolveFulfillmentPrompts(page);
        if (retryFulfillmentClicks.length > 0) {
          console.log(`  Fulfillment retry clicks: ${retryFulfillmentClicks.join(' -> ')}`);
          await page.waitForTimeout(1200);

          const ctaStillVisible = await page
            .locator('[data-testid="menu-item-cart-cta"]')
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false);
          if (!ctaStillVisible) {
            await openItemEditor(page, item.name);
            await page.waitForTimeout(1200);
          }

          const finalRetry = page.locator('[data-testid="menu-item-cart-cta"]').first();
          if (await finalRetry.isVisible({ timeout: 3000 }).catch(() => false)) {
            await finalRetry.click({ force: true, timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(1200);
            cartAfterAdd = await waitForCartAdvance(page, cartBeforeAdd, 5000);
          }
        }
      }

      if (!hasCartAdvanced(cartBeforeAdd, cartAfterAdd)) {
        throw new Error(
          `Item "${item.name}" was not added to cart. cartBefore=${JSON.stringify(cartBeforeAdd)} cartAfter=${JSON.stringify(cartAfterAdd)}`,
        );
      }

      console.log(`  Added to cart (count=${cartAfterAdd.count ?? 'unknown'})`);
      await page.waitForTimeout(1000);

      // Wait for modal to close
      for (let i = 0; i < 5; i++) {
        const overlay = page.locator('.modalOverlay, [class*="overlay"], [class*="Overlay"]').first();
        if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`  Waiting for modal to close...`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        } else {
          break;
        }
      }
      await page.waitForTimeout(500);
    }

    // Step 3: Go to checkout
    currentStage = 'checkout';
    console.log('\nStep 3: Going to checkout...');
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, 'checkout_start'));

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const cartStateAtCheckoutStart = await getToastCartState(page);
    console.log(
      `  Cart at checkout start: count=${cartStateAtCheckoutStart.count ?? 'unknown'} cta=${cartStateAtCheckoutStart.hasActionCta}`,
    );

    // Toast shows a floating "View order" bar or cart button after adding items
    const cartSelectors = [
      'button:has-text("View order")',
      'button:has-text("View Order")',
      'a:has-text("View order")',
      'button.targetAction',
      '[class*="targetAction"]',
      '[data-testid*="cart"]',
      '[data-testid*="order-summary"]',
      'button:has-text("Cart")',
      'button[aria-label*="cart" i]',
      'button[aria-label*="order" i]',
      '[class*="cartButton"]',
      '[class*="orderButton"]',
      '[class*="viewOrder"]',
    ];

    let cartFound = false;
    for (const selector of cartSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        const cartLabel = await el.innerText().catch(() => '');
        if (cartLabel.trim() === '0') {
          continue;
        }
        console.log(`  Found cart via: ${selector}`);
        await el.click({ force: true });
        cartFound = true;
        await page.waitForTimeout(2000);
        break;
      }
    }

    if (!cartFound) {
      console.log('  No cart button found, trying page debug...');
      const pageButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a')).slice(0, 30).map(el => ({
          tag: el.tagName,
          text: (el as HTMLElement).innerText?.trim().slice(0, 80) || '',
          className: el.className?.toString().slice(0, 80) || '',
        }));
      });
      console.log('  Page buttons:', JSON.stringify(pageButtons.filter(b => b.text), null, 2));
    }

    // Look for checkout button
    const checkoutSelectors = [
      'button:has-text("Checkout")',
      'a:has-text("Checkout")',
      'button:has-text("Continue")',
      'button:has-text("Continue to payment")',
      'button:has-text("Proceed to checkout")',
      'button:has-text("Place Order")',
      'button:has-text("Continue to checkout")',
      '[data-testid*="checkout"]',
    ];

    let checkoutClicked = false;
    for (const selector of checkoutSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`  Found checkout via: ${selector}`);
        await el.click();
        checkoutClicked = true;
        await page.waitForTimeout(3000);
        break;
      }
    }

    if (!checkoutClicked) {
      if (cartStateAtCheckoutStart.count !== null && cartStateAtCheckoutStart.count > 0) {
        const directCheckoutUrl = `${request.restaurantUrl.replace(/\/+$/, '')}/checkout`;
        console.log(`  Trying direct checkout fallback: ${directCheckoutUrl}`);
        await page.goto(directCheckoutUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2500);

        const isCheckoutLike = await page
          .locator(
            'input[name*="email" i], input[placeholder*="email" i], iframe#toast-checkout, iframe[name="toast-checkout"]',
          )
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        if (isCheckoutLike) {
          checkoutClicked = true;
          console.log('  Reached checkout via direct URL fallback');
        }
      }
    }

    if (!checkoutClicked) {
      // Debug: log what's on the page
      const debugButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a')).slice(0, 30).map(el => ({
          text: (el as HTMLElement).innerText?.trim().slice(0, 80) || '',
          className: el.className?.toString().slice(0, 80) || '',
        }));
      });
      throw new Error(`Checkout button not found. Buttons on page: ${JSON.stringify(debugButtons.filter(b => b.text))}`);
    }

    // Step 4: Handle delivery/pickup
    currentStage = 'delivery';
    console.log(`\nStep 4: Setting ${request.orderType}...`);
    if (request.orderType === 'delivery') {
      const deliveryTab = page.locator('button:has-text("Delivery"), [role="tab"]:has-text("Delivery")').first();
      if (await deliveryTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deliveryTab.click();
        await page.waitForTimeout(2000);
      }

      if (request.deliveryAddress) {
        console.log('  Entering delivery address...');
        const fullAddress = `${request.deliveryAddress.street}, ${request.deliveryAddress.city}, ${request.deliveryAddress.state} ${request.deliveryAddress.zip}`;
        const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="Address" i], input[name*="address" i]').first();
        await addressInput.click({ timeout: 10000 });
        await addressInput.fill(fullAddress);
        await page.waitForTimeout(1500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        const confirmAddressBtn = page.locator('button:has-text("Confirm address")');
        if (await confirmAddressBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('  Confirming address...');
          await confirmAddressBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      const pickupTab = page.locator('button:has-text("Pickup"), [role="tab"]:has-text("Pickup")').first();
      if (await pickupTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pickupTab.click();
        await page.waitForTimeout(2000);
      }
    }

    // Step 5: Fill customer info
    currentStage = 'customer_info';
    console.log('\nStep 5: Filling customer info...');
    await page.locator('input[name*="email" i], input[placeholder*="email" i]').first().fill(request.customer.email);
    await page.locator('input[name*="firstName" i], input[placeholder*="first" i]').first().fill(request.customer.firstName);
    await page.locator('input[name*="lastName" i], input[placeholder*="last" i]').first().fill(request.customer.lastName);

    const phoneInput = page.locator('input[name*="phone" i], input[type="tel"]').first();
    await phoneInput.click();
    const phoneDigits = request.customer.phone.replace(/\D/g, '');
    await phoneInput.pressSequentially(phoneDigits, { delay: 50 });
    await page.waitForTimeout(1500);

    // Handle SMS verification modal
    const guestCheckout = page.locator('text="Checkout as guest"');
    if (await guestCheckout.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Clicking "Checkout as guest"...');
      await guestCheckout.click();
      await page.waitForTimeout(2000);
    }

    // Uncheck email marketing checkbox
    await page.evaluate(() => {
      const checkbox = document.querySelector('#subscribeToEmailMarketing') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        checkbox.click();
      }
    });

    // Step 6: Fill payment info
    currentStage = 'payment';
    console.log('\nStep 6: Filling payment info...');
    const cardNumber = request.dryRun ? TEST_CARD : request.payment.cardNumber;

    // Toast uses their own payment iframe
    const checkoutFrame = page.frameLocator('iframe#toast-checkout, iframe[name="toast-checkout"]');

    await checkoutFrame.locator('input[name*="card"], input[placeholder*="Card"], input[autocomplete*="cc-number"]').first().fill(cardNumber, { timeout: 10000 });
    console.log('  Card number entered');

    await checkoutFrame.locator('input[name*="expir"], input[placeholder*="MM"], input[autocomplete*="cc-exp"]').first().fill(request.payment.expiry, { timeout: 10000 });
    console.log('  Expiry entered');

    await checkoutFrame.locator('input[name*="cvv"], input[name*="cvc"], input[placeholder*="CVV"], input[autocomplete*="cc-csc"]').first().fill(request.payment.cvv, { timeout: 10000 });
    console.log('  CVV entered');

    await checkoutFrame.locator('input[name*="zip"], input[placeholder*="ZIP"], input[autocomplete*="postal"]').first().fill(request.payment.zip, { timeout: 10000 });
    console.log('  Zip entered');

    // Step 7: Submit order
    currentStage = 'submit';
    console.log('\nStep 7: Submitting order...');
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, 'before_submit'));

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const placeOrderBtn = page.locator('button:has-text("Place Order")').first();
    await placeOrderBtn.scrollIntoViewIfNeeded();
    await placeOrderBtn.click({ timeout: 10000 });
    console.log('  Clicked Place Order');
    await page.waitForTimeout(3000);

    // Handle "Order delayed" modal
    for (let i = 0; i < 5; i++) {
      const delayedModal = page.locator('text=/order delayed|delivery time.*no longer available|new ready time/i').first();
      if (await delayedModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  Handling order delayed modal...');
        await page.waitForTimeout(500);

        const modalConfirmBtn = await page.evaluate(() => {
          const portal = document.querySelector('.PORTAL');
          if (portal) {
            const buttons = portal.querySelectorAll('button');
            for (const btn of buttons) {
              const text = btn.textContent?.toLowerCase() || '';
              if (text.includes('place order') && !btn.classList.contains('submitButton')) {
                return true;
              }
            }
          }
          return false;
        });

        if (modalConfirmBtn) {
          await page.evaluate(() => {
            const portal = document.querySelector('.PORTAL');
            if (portal) {
              const buttons = portal.querySelectorAll('button');
              for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('place order')) {
                  (btn as HTMLButtonElement).click();
                  break;
                }
              }
            }
          });
          console.log('  Confirmed delayed order');
          await page.waitForTimeout(3000);
          break;
        }
      }
      await page.waitForTimeout(1000);
    }

    // Check result
    currentStage = 'complete';
    await page.waitForTimeout(3000);
    const declined = await page.locator('text=/decline|failed|error/i').isVisible().catch(() => false);

    if (request.dryRun && declined) {
      console.log('\nDry run complete - card was declined as expected');
      return finish(
        { success: true, message: 'Dry run successful - order reached payment stage', stage: 'complete' },
      );
    }

    if (declined) {
      return finish(
        { success: false, message: 'Payment was declined', stage: 'payment' },
        'payment_declined',
      );
    }

    // Scrape confirmation page for tracking info
    console.log('\nStep 8: Scraping confirmation page...');
    const confirmation = await scrapeConfirmationPage(page);

    return finish({
      success: true,
      message: 'Order submitted successfully',
      stage: 'complete',
      orderId: confirmation.confirmationNumber,
      confirmation
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('\nOrder agent error:', msg);
    return finish(
      { success: false, message: `Order failed: ${msg}`, stage: currentStage },
      msg,
    );
  } finally {
    logBotRunTelemetry({
      runType: 'toast-order',
      success: didSucceed,
      stage: currentStage,
      cfDetected,
      proxyUsed: Boolean(proxyUrl),
      unlockerUsed: false,
      durationMs: Date.now() - startedAt,
      failReason,
      metadata: {
        url: request.restaurantUrl,
        orderType: request.orderType,
        itemCount: request.items.length,
        dryRun: Boolean(request.dryRun),
      },
    });
    await page.waitForTimeout(2000);
    await browser.close();
  }
}
