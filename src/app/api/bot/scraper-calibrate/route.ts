import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import {
  applyAutomationInitScript,
  BOT_USER_AGENT,
  buildChromiumLaunchOptions,
  ensureNoCloudflareBlock,
  getScraperProxyUrl,
  stabilizePage,
} from "@/lib/bot/browser-automation";
import { logBotRunTelemetry } from "@/lib/bot/bot-telemetry";

export const runtime = "nodejs";
export const maxDuration = 180; // 3 minutes

/**
 * Calibration endpoint to discover Toast's current HTML structure for modifiers.
 * Opens a Toast URL, clicks an item, and captures the page structure.
 * Note: Toast may either open a modal OR navigate to a new page for item details.
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let stage = "init";
  let cfDetected = false;
  let failReason: string | undefined;
  const body = await request.json();
  const { url, itemIndex = 0 } = body;

  if (!url) {
    return NextResponse.json({ ok: false, message: "URL required" }, { status: 400 });
  }

  const proxyUrl = getScraperProxyUrl();
  const launchOptions = buildChromiumLaunchOptions(proxyUrl);

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: BOT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: !!proxyUrl,
  });
  await applyAutomationInitScript(context);

  const page = await context.newPage();

  try {
    stage = "navigation";
    console.log(`[Calibrate] Opening ${url}...`);

    // Retry navigation up to 3 times
    let navigationSuccess = false;
    for (let attempt = 1; attempt <= 3 && !navigationSuccess; attempt++) {
      try {
        console.log(`[Calibrate] Navigation attempt ${attempt}/3...`);
        await page.goto(url, {
          waitUntil: attempt === 1 ? 'commit' : 'domcontentloaded',
          timeout: attempt === 1 ? 60000 : 90000
        });
        navigationSuccess = true;
      } catch (navError) {
        const msg = navError instanceof Error ? navError.message : String(navError);
        console.log(`[Calibrate] Attempt ${attempt} failed: ${msg}`);
        if (attempt === 3) throw navError;
        await page.waitForTimeout(2000);
      }
    }

    // Wait for page to render
    await stabilizePage(page);

    // Check if page is still valid after navigation
    let initialUrl: string;
    try {
      initialUrl = page.url();
    } catch {
      return NextResponse.json({ ok: false, message: "Page closed after navigation" }, { status: 500 });
    }

    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, "calibrate_initial_page"));

    // Dismiss popups
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);

    // Wait for menu items
    const menuCards = page.locator('[data-testid="menu-item-card"]');
    let cardCount: number;
    try {
      cardCount = await menuCards.count();
    } catch {
      return NextResponse.json({ ok: false, message: "Page closed while counting menu items" }, { status: 500 });
    }
    console.log(`[Calibrate] Found ${cardCount} menu item cards`);

    if (cardCount === 0) {
      const debugInfo = await page.evaluate(() => {
        return {
          hasBody: !!document.body,
          bodyText: document.body?.innerText?.substring(0, 500) || 'NO TEXT',
          title: document.title || 'NO TITLE',
          html: document.documentElement?.outerHTML?.substring(0, 2000) || 'NO HTML',
          readyState: document.readyState,
          scripts: document.querySelectorAll('script').length,
          iframes: document.querySelectorAll('iframe').length,
        };
      }).catch((e) => ({ error: String(e) }));

      return NextResponse.json({
        ok: false,
        message: "No menu items found",
        currentUrl: initialUrl,
        debugInfo,
      });
    }

    // Click the specified item
    const targetIndex = Math.min(itemIndex, cardCount - 1);
    const card = menuCards.nth(targetIndex);

    // Get item name before clicking
    const itemName = await card.locator('.itemName, [class*="itemName"], h3, h4').first().textContent().catch(() => "Unknown");
    console.log(`[Calibrate] Clicking item ${targetIndex}: ${itemName}`);

    await card.scrollIntoViewIfNeeded();

    // Click and wait for either navigation or modal
    await Promise.all([
      page.waitForURL((u) => u.toString() !== initialUrl, { timeout: 10000 }).catch(() => {}),
      card.click({ timeout: 5000, noWaitAfter: true }),
    ]);

    // Wait for page to stabilize after click/navigation
    stage = "analyze_item";
    await stabilizePage(page);
    cfDetected = cfDetected || (await ensureNoCloudflareBlock(page, "calibrate_after_click"));

    const currentUrl = page.url();
    const wasNavigation = currentUrl !== initialUrl;

    console.log(`[Calibrate] Navigation occurred: ${wasNavigation}, URL: ${currentUrl}`);

    // Analyze the current page (either item detail page or page with modal)
    const analysis = await page.evaluate(() => {
      // Look for modal first
      const modal = document.querySelector('[role="dialog"]');
      const targetElement = modal || document.body;

      if (!targetElement) {
        return { error: "No target element found (document.body is null)" };
      }

      const isModal = !!modal;

      // Get page/modal HTML (trimmed)
      const fullHtml = targetElement.outerHTML;

      // Find all unique class names
      const allElements = targetElement.querySelectorAll('*');
      const classSet = new Set<string>();
      allElements.forEach(el => {
        try {
          const className = el.getAttribute('class');
          if (className && typeof className === 'string') {
            className.split(/\s+/).forEach(c => {
              if (c.length > 2 && c.length < 50) classSet.add(c);
            });
          }
        } catch {
          // Skip elements that don't support getAttribute
        }
      });
      const allClasses = Array.from(classSet).sort();

      // Find all input elements
      const inputs = Array.from(targetElement.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
        className: input.getAttribute('class') || '',
        id: input.id,
        parentClass: input.parentElement?.getAttribute('class') || '',
        labelText: input.closest('label')?.textContent?.trim()?.slice(0, 50) || '',
      }));

      // Find all buttons that might be modifier options
      const buttons = Array.from(targetElement.querySelectorAll('button')).slice(0, 30).map(btn => ({
        text: btn.textContent?.trim().slice(0, 50) || '',
        className: btn.getAttribute('class') || '',
        type: btn.type,
        role: btn.getAttribute('role') || '',
        ariaPressed: btn.getAttribute('aria-pressed'),
      }));

      // Find clickable elements that might be options
      const clickables = Array.from(targetElement.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"], [tabindex="0"]')).slice(0, 30).map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role') || '',
        className: el.getAttribute('class') || '',
        text: (el as HTMLElement).innerText?.slice(0, 50) || '',
        ariaChecked: el.getAttribute('aria-checked'),
      }));

      // Find elements with relevant class names
      const relevantSelectors = ['option', 'modifier', 'choice', 'selection', 'customize', 'group', 'section', 'radio', 'checkbox'];
      const relevantElements: Array<{ selector: string; count: number; sampleClasses: string[]; sampleTexts: string[] }> = [];

      relevantSelectors.forEach(keyword => {
        const matches = targetElement.querySelectorAll(`[class*="${keyword}" i]`);
        if (matches.length > 0) {
          const sampleClasses = Array.from(matches).slice(0, 5).map(el => el.getAttribute('class') || '');
          const sampleTexts = Array.from(matches).slice(0, 5).map(el => (el as HTMLElement).innerText?.slice(0, 100) || '');
          relevantElements.push({
            selector: `[class*="${keyword}"]`,
            count: matches.length,
            sampleClasses,
            sampleTexts,
          });
        }
      });

      // Look for text indicating modifier sections
      const textNodes: string[] = [];
      const walker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() || '';
        if (text.length > 3 && text.length < 100 &&
            (text.toLowerCase().includes('choose') || text.toLowerCase().includes('select') ||
             text.toLowerCase().includes('add') || text.toLowerCase().includes('required') ||
             text.toLowerCase().includes('optional') || text.toLowerCase().includes('pick') ||
             text.toLowerCase().includes('size') || text.toLowerCase().includes('side') ||
             text.toLowerCase().includes('protein') || text.toLowerCase().includes('topping'))) {
          textNodes.push(text);
        }
      }

      // Find all h2, h3, h4 headings that might be group names
      const headings = Array.from(targetElement.querySelectorAll('h2, h3, h4, [class*="header" i], [class*="title" i]')).slice(0, 20).map(el => ({
        tag: el.tagName,
        className: el.getAttribute('class') || '',
        text: (el as HTMLElement).innerText?.slice(0, 100) || '',
      }));

      return {
        isModal,
        htmlLength: fullHtml.length,
        htmlPreview: fullHtml.slice(0, 8000),
        totalClasses: allClasses.length,
        relevantClasses: allClasses.filter(c =>
          c.toLowerCase().includes('mod') ||
          c.toLowerCase().includes('option') ||
          c.toLowerCase().includes('select') ||
          c.toLowerCase().includes('group') ||
          c.toLowerCase().includes('choice') ||
          c.toLowerCase().includes('radio') ||
          c.toLowerCase().includes('check')
        ),
        inputs,
        buttons,
        clickables,
        relevantElements,
        modifierHintTexts: [...new Set(textNodes)],
        headings,
      };
    });

    return NextResponse.json({
      ok: true,
      url,
      currentUrl,
      wasNavigation,
      itemName,
      itemIndex: targetIndex,
      totalItems: cardCount,
      analysis,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    failReason = message;
    console.error(`[Calibrate] Error: ${message}`);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  } finally {
    await browser.close().catch(() => {});
    logBotRunTelemetry({
      runType: "scraper-calibrate",
      success: failReason === undefined,
      stage,
      cfDetected,
      proxyUsed: Boolean(proxyUrl),
      unlockerUsed: false,
      durationMs: Date.now() - startedAt,
      failReason,
      metadata: {
        url,
        itemIndex,
      },
    });
  }
}
