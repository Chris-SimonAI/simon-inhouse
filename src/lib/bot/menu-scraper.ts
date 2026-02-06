import * as cheerio from 'cheerio';

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

/**
 * Fetch a URL using Bright Data's Web Unlocker API
 * Handles Cloudflare and other anti-bot protections automatically
 */
async function fetchWithWebUnlocker(url: string): Promise<string> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error('BRIGHTDATA_API_KEY environment variable is not set');
  }

  console.log(`  Fetching via Web Unlocker: ${url}`);

  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone: 'web_unlocker1',
      url: url,
      format: 'raw',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Web Unlocker API error: ${response.status} - ${errorText}`);
  }

  return response.text();
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
  const skipModifiers = options?.skipModifiers ?? false;

  console.log(`Scraping menu from ${restaurantUrl}...`);

  // Fetch the main menu page
  const html = await fetchWithWebUnlocker(restaurantUrl);
  const $ = cheerio.load(html);

  // Get restaurant name
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

  // Scrape modifiers by fetching each item's detail page
  if (!skipModifiers && items.length > 0) {
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
        const itemHtml = await fetchWithWebUnlocker(itemUrl);
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
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log(`    Error fetching modifiers for ${item.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.log(`Modifier scraping complete: ${itemsWithModifiers} items had modifiers`);
  }

  // Extract slug from URL
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

  return menu;
}
