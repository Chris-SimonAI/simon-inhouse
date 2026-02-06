import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Calibration endpoint to discover Toast's current HTML structure for modifiers.
 * Opens a Toast URL, clicks an item, and captures the full modal HTML.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, itemIndex = 0 } = body;

  if (!url) {
    return NextResponse.json({ ok: false, message: "URL required" }, { status: 400 });
  }

  const proxyUrl = process.env.SCRAPER_PROXY_URL;
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  };

  if (proxyUrl) {
    const parsed = new URL(proxyUrl);
    launchOptions.proxy = {
      server: `${parsed.protocol}//${parsed.host}`,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: !!proxyUrl,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    console.log(`[Calibrate] Opening ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Dismiss popups
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);

    // Wait for menu items
    const menuCards = page.locator('[data-testid="menu-item-card"]');
    const cardCount = await menuCards.count();
    console.log(`[Calibrate] Found ${cardCount} menu item cards`);

    if (cardCount === 0) {
      await browser.close();
      return NextResponse.json({
        ok: false,
        message: "No menu items found",
        pageTitle: await page.title(),
      });
    }

    // Click the specified item
    const targetIndex = Math.min(itemIndex, cardCount - 1);
    const card = menuCards.nth(targetIndex);

    // Get item name before clicking
    const itemName = await card.locator('.itemName, [class*="itemName"], h3, h4').first().textContent().catch(() => "Unknown");
    console.log(`[Calibrate] Clicking item ${targetIndex}: ${itemName}`);

    await card.scrollIntoViewIfNeeded();
    await card.click({ timeout: 5000, noWaitAfter: true });

    // Wait for modal
    const addButton = page.locator('button:has-text("Add")').first();
    const modalOpened = await addButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);

    if (!modalOpened) {
      await browser.close();
      return NextResponse.json({
        ok: false,
        message: "Modal did not open after clicking item",
        itemName,
      });
    }

    // Wait for content to render
    await page.waitForTimeout(2000);

    // Capture comprehensive modal structure
    const analysis = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { error: "No modal found" };

      // Get full modal HTML (trimmed for size)
      const fullHtml = modal.outerHTML;

      // Find all unique class names in the modal
      const allElements = modal.querySelectorAll('*');
      const classSet = new Set<string>();
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(/\s+/).forEach(c => {
            if (c.length > 2 && c.length < 50) classSet.add(c);
          });
        }
      });
      const allClasses = Array.from(classSet).sort();

      // Find all input elements
      const inputs = Array.from(modal.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
        className: input.className,
        id: input.id,
        parentClass: input.parentElement?.className || '',
      }));

      // Find all elements with "option", "modifier", "choice", "selection" in class name
      const relevantSelectors = ['option', 'modifier', 'choice', 'selection', 'customize', 'group', 'section'];
      const relevantElements: Array<{ selector: string; count: number; sampleClasses: string[] }> = [];

      relevantSelectors.forEach(keyword => {
        const matches = modal.querySelectorAll(`[class*="${keyword}" i]`);
        if (matches.length > 0) {
          const sampleClasses = Array.from(matches).slice(0, 3).map(el => el.className);
          relevantElements.push({
            selector: `[class*="${keyword}"]`,
            count: matches.length,
            sampleClasses,
          });
        }
      });

      // Find div/section structures that might contain modifiers
      const potentialContainers = Array.from(modal.querySelectorAll('div, section, fieldset')).filter(el => {
        // Look for containers with multiple child elements that might be options
        const children = el.children;
        if (children.length < 2) return false;
        // Check if children have similar structure (likely options)
        const childClasses = Array.from(children).map(c => c.className);
        const uniqueClasses = new Set(childClasses);
        return uniqueClasses.size <= 3 && children.length >= 2;
      }).slice(0, 10).map(el => ({
        tagName: el.tagName,
        className: el.className,
        childCount: el.children.length,
        sampleChildClasses: Array.from(el.children).slice(0, 3).map(c => c.className),
        firstChildText: (el.children[0] as HTMLElement)?.innerText?.slice(0, 100) || '',
      }));

      // Look for text that indicates modifier sections (like "Choose your size", "Add toppings")
      const textNodes: string[] = [];
      const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() || '';
        if (text.length > 3 && text.length < 100 && !text.includes('$') &&
            (text.toLowerCase().includes('choose') || text.toLowerCase().includes('select') ||
             text.toLowerCase().includes('add') || text.toLowerCase().includes('required') ||
             text.toLowerCase().includes('optional') || text.toLowerCase().includes('pick'))) {
          textNodes.push(text);
        }
      }

      return {
        modalFound: true,
        htmlLength: fullHtml.length,
        htmlPreview: fullHtml.slice(0, 5000),
        allClasses,
        inputs,
        relevantElements,
        potentialContainers,
        modifierHintTexts: [...new Set(textNodes)],
      };
    });

    await browser.close();

    return NextResponse.json({
      ok: true,
      url,
      itemName,
      itemIndex: targetIndex,
      totalItems: cardCount,
      analysis,
    });

  } catch (error) {
    await browser.close();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
