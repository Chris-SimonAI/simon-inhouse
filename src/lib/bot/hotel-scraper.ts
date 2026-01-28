import { chromium } from 'playwright';

export interface ScrapedHotel {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  slug: string;
}

/**
 * Scrape hotel name and address from a hotel website URL,
 * then geocode the address to get coordinates.
 */
export async function scrapeHotel(hotelUrl: string): Promise<ScrapedHotel> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`[hotel-scraper] Scraping hotel from ${hotelUrl}...`);

    await page.goto(hotelUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Scrape hotel name
    const name = await page.evaluate(() => {
      // Try og:title first
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        const content = ogTitle.getAttribute('content')?.trim();
        if (content) return content;
      }

      // Try schema.org Hotel structured data
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Hotel' || item['@type'] === 'LodgingBusiness') {
              if (item.name) return item.name;
            }
          }
        } catch { /* skip */ }
      }

      // Try h1
      const h1 = document.querySelector('h1');
      if (h1) {
        const text = h1.textContent?.trim();
        if (text && text.length < 100) return text;
      }

      // Fallback to title tag (clean up common suffixes)
      const title = document.title || '';
      return title
        .replace(/\s*[-|–]\s*(official site|home|welcome|book).*/i, '')
        .replace(/\s*[-|–]\s*$/, '')
        .trim();
    });

    if (!name) {
      throw new Error('Could not scrape hotel name');
    }
    console.log(`[hotel-scraper] Name: ${name}`);

    // Scrape address
    const address = await page.evaluate(() => {
      // Try schema.org structured data
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Hotel' || item['@type'] === 'LodgingBusiness') {
              const addr = item.address;
              if (typeof addr === 'string') return addr;
              if (addr && typeof addr === 'object') {
                const parts = [
                  addr.streetAddress,
                  addr.addressLocality,
                  addr.addressRegion,
                  addr.postalCode,
                ].filter(Boolean);
                if (parts.length >= 2) return parts.join(', ');
              }
            }
          }
        } catch { /* skip */ }
      }

      // Try og:street-address or og:locality meta tags
      const ogStreet = document.querySelector('meta[property="og:street-address"], meta[name="geo.position"]');
      if (ogStreet) {
        const content = ogStreet.getAttribute('content')?.trim();
        if (content) return content;
      }

      // Try common address selectors
      const addressSelectors = [
        '[itemtype*="PostalAddress"]',
        '[class*="address" i]',
        'address',
        '[data-testid*="address" i]',
      ];
      for (const selector of addressSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.textContent?.trim().replace(/\s+/g, ' ');
          if (text && text.length > 10 && text.length < 200) return text;
        }
      }

      // Try to find address pattern in page text
      const pageText = document.body.innerText || '';
      const addressPattern = /(\d{1,5}\s+[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Way|Lane|Ln|Place|Pl|Court|Ct)[^,]*,\s*[A-Z][a-z]+[^,]*,\s*[A-Z]{2}\s*\d{5})/i;
      const match = pageText.match(addressPattern);
      if (match) return match[1].trim();

      return null;
    });

    if (!address) {
      throw new Error('Could not scrape hotel address');
    }
    console.log(`[hotel-scraper] Address: ${address}`);

    // Try to get coordinates from structured data first
    let latitude: number | null = null;
    let longitude: number | null = null;

    const coords = await page.evaluate(() => {
      // Check schema.org data for geo coordinates
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item.geo) {
              const lat = parseFloat(item.geo.latitude);
              const lng = parseFloat(item.geo.longitude);
              if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
            }
          }
        } catch { /* skip */ }
      }

      // Check for Google Maps embed
      const mapIframes = document.querySelectorAll('iframe[src*="google.com/maps"]');
      for (const iframe of mapIframes) {
        const src = iframe.getAttribute('src') || '';
        const llMatch = src.match(/[@!](-?\d+\.?\d*)[,!](-?\d+\.?\d*)/);
        if (llMatch) {
          return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
        }
        const qMatch = src.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (qMatch) {
          return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
        }
      }

      // Check meta tags
      const geoPosition = document.querySelector('meta[name="geo.position"]');
      if (geoPosition) {
        const content = geoPosition.getAttribute('content') || '';
        const parts = content.split(';').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return { lat: parts[0], lng: parts[1] };
        }
      }

      return null;
    });

    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
      console.log(`[hotel-scraper] Coordinates from page: ${latitude}, ${longitude}`);
    }

    // Geocode if no coordinates found from page
    if (latitude === null || longitude === null) {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        console.log(`[hotel-scraper] Geocoding address...`);
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const res = await fetch(geocodeUrl);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          latitude = location.lat;
          longitude = location.lng;
          console.log(`[hotel-scraper] Geocoded coordinates: ${latitude}, ${longitude}`);
        }
      }
    }

    if (latitude === null || longitude === null) {
      throw new Error('Could not determine hotel coordinates. Please enter them manually.');
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);

    console.log(`[hotel-scraper] Slug: ${slug}`);

    return { name, address, latitude, longitude, slug };
  } finally {
    await browser.close();
  }
}
