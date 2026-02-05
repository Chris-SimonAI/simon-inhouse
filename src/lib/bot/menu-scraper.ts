import { chromium, Page } from 'playwright';

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
  deliveryEta?: string; // e.g., "40 - 45 min"
}

/**
 * Dismiss any popups/modals that might block the menu
 */
async function dismissPopups(page: Page): Promise<void> {
  const dismissPatterns = [
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    'button:has-text("No thanks")',
    'button[aria-label*="close" i]',
    '[class*="close" i]:is(button)',
  ];

  for (const pattern of dismissPatterns) {
    try {
      const btn = page.locator(pattern).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
      }
    } catch {
      // Continue
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * Handle the "Restaurant is closed" modal
 */
async function handleClosedModal(page: Page): Promise<{ hours?: RestaurantHours; wasClosed: boolean }> {
  let wasClosed = false;

  const closedPatterns = [
    'text=/closed/i',
    'text=/not accepting orders/i',
    'text=/currently unavailable/i',
    'text=/opens at/i',
  ];

  for (const pattern of closedPatterns) {
    const element = page.locator(pattern).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      wasClosed = true;
      console.log('  Restaurant appears to be closed, looking for schedule option...');

      const schedulePatterns = [
        'button:has-text("Schedule")',
        'button:has-text("Order for later")',
        'button:has-text("Schedule for later")',
        'button:has-text("Pick a time")',
        'button:has-text("Continue")',
      ];

      for (const schedulePattern of schedulePatterns) {
        const scheduleBtn = page.locator(schedulePattern).first();
        if (await scheduleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  Found schedule option, clicking...');
          await scheduleBtn.click();
          await page.waitForTimeout(2000);

          const timeOption = page.locator('[class*="time"] button, [class*="slot"]').first();
          if (await timeOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await timeOption.click();
            await page.waitForTimeout(1000);
          }

          const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Continue"), button:has-text("Done")').first();
          if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
          break;
        }
      }

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
      break;
    }
  }

  return { hours: undefined, wasClosed };
}

/**
 * Extract restaurant hours from the page
 */
async function scrapeHours(page: Page): Promise<RestaurantHours | undefined> {
  try {
    const hours = await page.evaluate(() => {
      const result: Record<string, Array<{ open: string; close: string }>> = {};
      const pageText = document.body.innerText;

      const dayPatterns = [
        /monday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /tuesday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /wednesday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /thursday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /friday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /saturday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
        /sunday[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
      ];

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      days.forEach((day, index) => {
        const match = dayPatterns[index].exec(pageText);
        if (match) {
          result[day] = [{ open: match[1].trim(), close: match[2].trim() }];
        }
      });

      if (Object.keys(result).length === 0) {
        const generalMatch = pageText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
        if (generalMatch) {
          days.forEach(day => {
            result[day] = [{ open: generalMatch[1].trim(), close: generalMatch[2].trim() }];
          });
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    });

    return hours || undefined;
  } catch {
    return undefined;
  }
}

export async function scrapeMenu(restaurantUrl: string, options?: { skipModifiers?: boolean }): Promise<ScrapedMenu> {
  const skipModifiers = options?.skipModifiers ?? false;

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  // Hide automation signals from Cloudflare
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as Record<string, unknown>).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    console.log(`Scraping menu from ${restaurantUrl}...`);

    await page.goto(restaurantUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to fully render - longer wait for server environments
    await page.waitForTimeout(5000);

    // Handle Cloudflare challenge
    const cfChallenge = await page.locator('text="Verify you are human"').isVisible({ timeout: 3000 }).catch(() => false);
    const cfTurnstile = await page.locator('iframe[src*="challenges.cloudflare.com"]').isVisible({ timeout: 1000 }).catch(() => false);

    if (cfChallenge || cfTurnstile) {
      console.log('  Cloudflare challenge detected, waiting for resolution...');
      // Try clicking the checkbox/turnstile
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkbox.click();
      }
      // Wait longer for challenge to resolve
      await page.waitForTimeout(15000);

      // Check if we're still on a challenge page
      const stillBlocked = await page.locator('text="Verify you are human"').isVisible({ timeout: 2000 }).catch(() => false);
      if (stillBlocked) {
        console.log('  Cloudflare challenge still present, waiting more...');
        await page.waitForTimeout(10000);
      }
    }

    // Check if we got a Cloudflare block page instead of the menu
    const pageTitle = await page.title();
    if (pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
      console.log('  Cloudflare block page detected, retrying with networkidle...');
      await page.goto(restaurantUrl, {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      await page.waitForTimeout(5000);
    }

    await dismissPopups(page);
    const { wasClosed } = await handleClosedModal(page);
    if (wasClosed) {
      console.log('  Handled closed restaurant modal');
    }
    await page.waitForTimeout(1000);

    // IMPORTANT: Scrape address FIRST while still on Pickup mode (address is visible there)
    // Toast shows: "Pickup from 1329 Santa Monica Boulevard, Santa Monica, CA"
    const address = await page.evaluate(() => {
      const pageText = document.body.innerText || '';

      let addressLine1 = '';
      let city = '';
      let state = '';
      let zipCode = '';

      // Method 1: Look for "Pickup from" text which has full address
      const pickupMatch = pageText.match(/Pickup\s+from\s+(\d+\s+[^,]+),\s*([^,]+),\s*([A-Z]{2})/i);
      if (pickupMatch) {
        addressLine1 = pickupMatch[1].trim();
        city = pickupMatch[2].trim();
        state = pickupMatch[3].trim();
      }

      // Method 2: Look for City, ST ZIP pattern (e.g., "Santa Monica, CA 90404")
      if (!zipCode) {
        const cityStateZipMatch = pageText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5})/);
        if (cityStateZipMatch) {
          if (!city) city = cityStateZipMatch[1].trim();
          if (!state) state = cityStateZipMatch[2].trim();
          zipCode = cityStateZipMatch[3].trim();
        }
      }

      // Method 3: Look for street address pattern if not found yet
      if (!addressLine1) {
        const streetMatch = pageText.match(/(\d+\s+[\w\s]+(?:Boulevard|Blvd|Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Way|Lane|Ln|Place|Pl|Court|Ct))\b/i);
        if (streetMatch) {
          addressLine1 = streetMatch[1].trim();
        }
      }

      // Get phone number
      let phoneNumber = '';
      const phoneEl = document.querySelector('a[href^="tel:"]');
      if (phoneEl) {
        phoneNumber = phoneEl.getAttribute('href')?.replace('tel:', '') || '';
      }
      if (!phoneNumber) {
        const phoneMatch = pageText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) {
          phoneNumber = phoneMatch[0];
        }
      }

      if (addressLine1 || city || state || zipCode) {
        return {
          addressLine1: addressLine1 || undefined,
          city: city || undefined,
          state: state || undefined,
          zipCode: zipCode || undefined,
          country: 'USA',
          phoneNumber: phoneNumber || undefined,
        };
      }

      return phoneNumber ? { phoneNumber } : undefined;
    });

    if (address) {
      console.log(`  Address: ${address.addressLine1 || ''}, ${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`);
    } else {
      console.log('  No address found');
    }

    // NOW click "Delivery" tab (after scraping address from Pickup view)
    try {
      const deliveryTab = page.locator('button:has-text("Delivery"), [role="tab"]:has-text("Delivery")').first();
      if (await deliveryTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deliveryTab.click();
        console.log('  Clicked Delivery tab');
        await page.waitForTimeout(1500);
      }
    } catch {
      console.log('  No Delivery tab found, continuing...');
    }

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(2000);

    // Wait for menu items with retry logic
    const menuSelectors = [
      '[data-testid="menu-item-card"]',
      'li.item',
      '[class*="menuItem"]',
      '[class*="MenuItem"]',
      '[class*="menu-item"]',
      '[class*="MenuCard"]',
      '.itemContainer',
      '[class*="product-card"]',
    ];

    let menuFound = false;
    let foundSelector = '';

    // Try multiple times with increasing waits for slow-loading pages
    for (let attempt = 0; attempt < 3 && !menuFound; attempt++) {
      if (attempt > 0) {
        console.log(`  Retry ${attempt}: waiting for menu items to load...`);
        await page.waitForTimeout(3000);
      }

      for (const selector of menuSelectors) {
        try {
          // Wait for at least one element to appear
          const locator = page.locator(selector).first();
          await locator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

          const count = await page.locator(selector).count();
          if (count > 0) {
            menuFound = true;
            foundSelector = selector;
            console.log(`  Found ${count} menu items with: ${selector}`);
            break;
          }
        } catch {
          // Try next
        }
      }
    }

    if (!menuFound) {
      // Log page info for debugging
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`  Page title: ${pageTitle}`);
      console.log(`  Page URL: ${pageUrl}`);
      throw new Error('Could not find menu items on page');
    }

    await page.waitForTimeout(2000);

    // Get restaurant name
    const restaurantName = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) return h1.textContent?.trim();
      const title = document.title;
      return title.split('|')[0]?.trim() || 'Restaurant';
    });

    // Get hero image
    const heroImage = await page.evaluate(() => {
      const heroSelectors = [
        '[class*="hero" i] img',
        '[class*="banner" i] img',
        '[class*="header" i] img:not([class*="logo" i])',
        'header img[src*="cloudinary"]',
      ];

      for (const selector of heroSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const src = el.getAttribute('src');
          if (src && src.includes('cloudinary') && !src.includes('logo')) {
            return src;
          }
        }
      }

      const images = document.querySelectorAll('img');
      for (const img of images) {
        const src = img.getAttribute('src') || '';
        if (src.includes('cloudinary') && !src.includes('logo')) {
          const rect = img.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 100 && rect.top < 500) {
            return src;
          }
        }
      }

      return null;
    });

    // Get delivery ETA
    const deliveryEta = await page.evaluate(() => {
      // Look for "Estimated in X - Y min" text
      const etaPatterns = [
        /estimated\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
        /(\d+\s*-\s*\d+\s*min)/i,
        /delivery\s+in\s+(\d+\s*-\s*\d+\s*min)/i,
      ];

      const pageText = document.body.innerText || '';
      for (const pattern of etaPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
      return undefined;
    });

    if (deliveryEta) {
      console.log(`  Delivery ETA: ${deliveryEta}`);
    }

    // Get categories
    const categories = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[data-testid^="menu-tab-"], [class*="categoryTab"], [class*="menuTab"]');
      return Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean) as string[];
    });

    // Scrape all menu items
    const rawItems = await page.evaluate(() => {
      const results: { name: string; description: string; price: string; image: string; category: string }[] = [];

      const itemSelectors = '[data-testid="menu-item-card"], li.item, [class*="menuItem"], [class*="MenuItem"]';
      const items = document.querySelectorAll(itemSelectors);

      let currentCategory = 'Menu';

      items.forEach((item) => {
        const group = item.closest('[data-testid^="menu-group-"], [class*="menuGroup"], [class*="MenuGroup"]');
        if (group) {
          const header = group.querySelector('h2, h3, [class*="categoryHeader"], [class*="groupHeader"]');
          if (header) {
            currentCategory = header.textContent?.trim() || currentCategory;
          }
        }

        const nameEl = item.querySelector('.itemName, [class*="itemName"], [class*="ItemName"], h3, h4, strong');
        const descEl = item.querySelector('.itemDescription, [class*="itemDescription"], [class*="ItemDescription"], p');
        const priceEl = item.querySelector('.itemPrice, [class*="itemPrice"], [class*="ItemPrice"], [class*="price"]');
        const imgEl = item.querySelector('img');

        const name = nameEl?.textContent?.trim() || '';
        const description = descEl?.textContent?.trim() || '';
        const priceText = priceEl?.textContent?.trim() || '';
        const image = imgEl?.getAttribute('src') || '';

        if (name && name.length > 0) {
          results.push({ name, description, price: priceText, image, category: currentCategory });
        }
      });

      return results;
    });

    // Convert to MenuItem format
    const items: MenuItem[] = rawItems.map((raw, index) => {
      const priceMatch = raw.price.match(/[\d.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

      return {
        id: `item-${index}`,
        name: raw.name,
        description: raw.description,
        price,
        category: raw.category,
        image: raw.image || undefined,
        modifiers: []
      };
    });

    // Scrape modifiers by clicking each item
    if (!skipModifiers) {
      console.log('Scraping modifiers for each item...');

      for (let i = 0; i < Math.min(items.length, 50); i++) {
        const item = items[i];
        try {
          // Click on the item to open modal
          const itemCard = page.locator(`[data-testid="menu-item-card"]:has-text("${item.name}")`).first();
          const cardVisible = await itemCard.isVisible({ timeout: 1000 }).catch(() => false);

          const itemElement = cardVisible ? itemCard : page.locator(`span:has-text("${item.name}")`).first();

          const visible = await itemElement.isVisible({ timeout: 1000 }).catch(() => false);
          if (visible) {
            await itemElement.click();

            // Wait for modal to appear
            const addButton = page.locator('button:has-text("Add")').first();
            const modalOpened = await addButton.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);

            if (!modalOpened) {
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(300);
              continue;
            }

            await page.waitForTimeout(500);

            // Check if Add button is disabled (indicates required selection)
            const addButtonDisabled = await addButton.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);

            // Scrape modifiers from the modal
            const { modifierGroups, flatModifiers } = await page.evaluate((args: { itemName: string; isAddDisabled: boolean }) => {
              const { itemName } = args;
              const groups: Array<{
                name: string;
                required: boolean;
                minSelections: number;
                maxSelections: number;
                options: Array<{ name: string; price: number }>
              }> = [];
              const flatModifiers: Array<{ name: string; price: number; groupName?: string }> = [];
              const seenOptions = new Set<string>();

              const modal = document.querySelector('[role="dialog"]');
              if (!modal) return { modifierGroups: groups, flatModifiers };

              // Toast-specific: Find modifier sections using their class names
              const modSections = modal.querySelectorAll('.modSection');

              if (modSections.length > 0) {
                modSections.forEach((section) => {
                  // Get group name from .modSectionTitle
                  const titleEl = section.querySelector('.modSectionTitle');
                  let groupName = titleEl?.textContent?.trim() || 'Options';
                  // Remove "Required" text that might be appended
                  groupName = groupName.replace(/Required$/i, '').trim();

                  // Get selection rules from .modSectionSubtitle
                  const subtitleEl = section.querySelector('.modSectionSubtitle');
                  const subtitleText = subtitleEl?.textContent?.toLowerCase() || '';

                  // Determine if required
                  const titleContainer = section.querySelector('.modSectionTitleContainer');
                  const hasRequiredBadge = titleContainer?.textContent?.includes('Required') || false;
                  const hasRadios = section.querySelectorAll('input[type="radio"]').length > 0;
                  const isRequired = hasRequiredBadge || hasRadios;

                  // Parse selection counts from subtitle
                  let minSelections = 0;
                  let maxSelections = 10;

                  // "Select 1" -> min=1, max=1
                  const exactMatch = subtitleText.match(/select\s+(\d+)$/);
                  if (exactMatch) {
                    minSelections = parseInt(exactMatch[1]);
                    maxSelections = parseInt(exactMatch[1]);
                  }

                  // "Select 1 to 2" -> min=1, max=2
                  const rangeMatch = subtitleText.match(/select\s+(\d+)\s+to\s+(\d+)/);
                  if (rangeMatch) {
                    minSelections = parseInt(rangeMatch[1]);
                    maxSelections = parseInt(rangeMatch[2]);
                  }

                  // "Select up to 3" -> min=0, max=3
                  const upToMatch = subtitleText.match(/(?:up\s+to|max(?:imum)?)\s+(\d+)/);
                  if (upToMatch) {
                    maxSelections = parseInt(upToMatch[1]);
                  }

                  // "Optional" -> min=0
                  if (subtitleText.includes('optional')) {
                    minSelections = 0;
                  }

                  // If required but no min set, default to 1
                  if (isRequired && minSelections === 0) {
                    minSelections = 1;
                  }

                  // If radio buttons, max is 1
                  if (hasRadios) {
                    maxSelections = 1;
                  }

                  // Get options from .option elements
                  const options: Array<{ name: string; price: number }> = [];
                  const optionEls = section.querySelectorAll('.option');

                  optionEls.forEach((optionEl) => {
                    // Get modifier name from .modifierText or similar
                    const nameEl = optionEl.querySelector('.modifierText, .modifierTextContent, [class*="modifierText"]');
                    let name = nameEl?.textContent?.trim() || '';

                    // Fallback: try getting text from label or the option itself
                    if (!name) {
                      const label = optionEl.querySelector('label');
                      name = label?.textContent?.replace(/\+?\$[\d.]+/g, '').trim() || '';
                    }

                    // Clean up name
                    name = name.replace(/\+?\$[\d.]+/g, '').replace(/\s+/g, ' ').trim();

                    if (!name || name.length < 2 || name.length > 80 || seenOptions.has(name)) return;
                    const lower = name.toLowerCase();
                    if (lower.includes('add to') || lower.includes('cart') || lower.includes('quantity') ||
                        lower.includes('special instruction') || lower.includes('subscribe') ||
                        lower.includes('marketing') || name === itemName) return;

                    // Get price
                    let price = 0;
                    const optionText = optionEl.textContent || '';
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
              } else {
                // Fallback for non-Toast sites or different layouts
                const fallbackSections = modal.querySelectorAll('fieldset, [class*="modifierGroup"], [class*="ModifierGroup"]');

                if (fallbackSections.length > 0) {
                  fallbackSections.forEach((section) => {
                    const legend = section.querySelector('legend, h3, h4, [class*="groupName"], [class*="header"]');
                    const groupName = legend?.textContent?.replace(/\s*\(.*\)/, '').replace(/Required$/i, '').trim() || 'Options';
                    const sectionText = section.textContent?.toLowerCase() || '';
                    const groupRequired = /required/i.test(sectionText) || section.querySelectorAll('input[type="radio"]').length > 0;

                    const options: Array<{ name: string; price: number }> = [];

                    section.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
                      const label = (input as HTMLInputElement).closest('label') || input.parentElement;
                      if (!label) return;

                      const text = label.textContent || '';
                      const name = text.replace(/\+?\$[\d.]+/g, '').trim().replace(/\s+/g, ' ');

                      if (!name || name.length < 2 || name.length > 80 || seenOptions.has(name)) return;
                      const lower = name.toLowerCase();
                      if (lower.includes('add to') || lower.includes('cart') || lower.includes('quantity') ||
                          lower.includes('special instruction') || lower.includes('subscribe') ||
                          lower.includes('marketing') || name === itemName) return;

                      let price = 0;
                      const priceMatch = text.match(/\+?\$(\d+\.?\d*)/);
                      if (priceMatch) price = parseFloat(priceMatch[1]);

                      seenOptions.add(name);
                      options.push({ name, price });
                      flatModifiers.push({ name, price, groupName });
                    });

                    if (options.length > 0) {
                      groups.push({
                        name: groupName,
                        required: groupRequired,
                        minSelections: groupRequired ? 1 : 0,
                        maxSelections: section.querySelectorAll('input[type="radio"]').length > 0 ? 1 : 10,
                        options
                      });
                    }
                  });
                } else {
                  // Last resort: collect all checkboxes/radios
                  const options: Array<{ name: string; price: number }> = [];
                  modal.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
                    const label = (input as HTMLInputElement).closest('label') || input.parentElement;
                    if (!label) return;

                    const text = label.textContent || '';
                    const name = text.replace(/\+?\$[\d.]+/g, '').trim().replace(/\s+/g, ' ');

                    if (!name || name.length < 2 || name.length > 80 || seenOptions.has(name)) return;
                    const lower = name.toLowerCase();
                    if (lower.includes('add to') || lower.includes('cart') || lower.includes('quantity') ||
                        lower.includes('special instruction') || lower.includes('subscribe') ||
                        lower.includes('marketing') || name === itemName) return;

                    let price = 0;
                    const priceMatch = text.match(/\+?\$(\d+\.?\d*)/);
                    if (priceMatch) price = parseFloat(priceMatch[1]);

                    seenOptions.add(name);
                    options.push({ name, price });
                    flatModifiers.push({ name, price });
                  });

                  if (options.length > 0) {
                    groups.push({
                      name: 'Customizations',
                      required: false,
                      minSelections: 0,
                      maxSelections: 10,
                      options
                    });
                  }
                }
              }

              return { modifierGroups: groups, flatModifiers };
            }, { itemName: item.name, isAddDisabled: addButtonDisabled });

            if (flatModifiers.length > 0) {
              item.modifiers = flatModifiers;
              item.modifierGroups = modifierGroups;
              const requiredGroups = modifierGroups.filter(g => g.required).length;
              console.log(`  ${item.name}: ${flatModifiers.length} modifiers (${requiredGroups} required groups)`);
            }

            // Close the modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);

            const stillVisible = await addButton.isVisible({ timeout: 300 }).catch(() => false);
            if (stillVisible) {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
            }
          }
        } catch (e: unknown) {
          console.log(`  Error scraping ${item.name}: ${e instanceof Error ? e.message : String(e)}`);
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }

    const slugMatch = restaurantUrl.match(/\/order\/([^\\/\\?]+)/);
    const restaurantSlug = slugMatch ? slugMatch[1] : 'unknown';

    const uniqueCategories = [...new Set(items.map(i => i.category))];

    const hours = await scrapeHours(page);

    const menu: ScrapedMenu = {
      restaurantName: restaurantName || 'Unknown Restaurant',
      restaurantSlug,
      url: restaurantUrl,
      items,
      categories: uniqueCategories.length > 0 ? uniqueCategories : (categories.length > 0 ? categories : ['Menu']),
      scrapedAt: new Date().toISOString(),
      hours,
      heroImage: heroImage || undefined,
      address: address || undefined,
      deliveryEta: deliveryEta || undefined,
    };

    console.log(`Scraped ${items.length} items from ${menu.restaurantName}`);
    console.log(`Categories: ${menu.categories.join(', ')}`);

    return menu;
  } finally {
    await browser.close();
  }
}
