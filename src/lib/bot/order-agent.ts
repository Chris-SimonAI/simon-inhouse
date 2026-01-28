import { chromium, Page } from 'playwright';

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
  let currentStage = 'init';

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
    console.log('=== Toast Order Agent ===');
    console.log(`Restaurant: ${request.restaurantUrl}`);
    console.log(`Items: ${request.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);

    // Step 1: Navigate to restaurant
    currentStage = 'page_load';
    console.log('\nStep 1: Loading restaurant page...');
    await page.goto(request.restaurantUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Step 2: Add items to cart
    currentStage = 'add_to_cart';
    console.log('\nStep 2: Adding items to cart...');
    for (const item of request.items) {
      console.log(`  Looking for "${item.name}"...`);

      const itemElement = page.locator(`span:has-text("${item.name}")`).first();
      await itemElement.click({ timeout: 30000 });
      console.log(`  Clicked ${item.name}`);
      await page.waitForTimeout(2000);

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
      const addBtn = page.locator('button:has-text("Add")').first();
      const isDisabled = await addBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);

      if (isDisabled) {
        console.log(`  Add button disabled - checking for required modifiers...`);

        const requiredGroups = await page.evaluate(() => {
          const groups: string[] = [];

          const containers = document.querySelectorAll('fieldset, [role="group"], [class*="modifier"]');
          containers.forEach(container => {
            const text = container.textContent || '';
            const hasRequired = /required/i.test(text);
            const hasRadios = container.querySelectorAll('input[type="radio"]').length > 0;
            const hasChecked = container.querySelector('input:checked') !== null;

            if ((hasRequired || hasRadios) && !hasChecked) {
              const firstLabel = container.querySelector('label');
              if (firstLabel) {
                groups.push(firstLabel.textContent?.replace(/\+?\$[\d.]+/g, '').trim() || '');
              }
            }
          });

          const unselectedRadioGroups = document.querySelectorAll('input[type="radio"]:not(:checked)');
          const radioGroupNames = new Set<string>();
          unselectedRadioGroups.forEach(radio => {
            const name = (radio as HTMLInputElement).name;
            if (name && !radioGroupNames.has(name)) {
              radioGroupNames.add(name);
              const label = document.querySelector(`label[for="${radio.id}"]`) || (radio as HTMLInputElement).closest('label');
              if (label) {
                groups.push(label.textContent?.replace(/\+?\$[\d.]+/g, '').trim() || '');
              }
            }
          });

          return [...new Set(groups)];
        });

        for (const optionName of requiredGroups) {
          if (optionName) {
            console.log(`    Auto-selecting required: ${optionName}`);
            const optionElement = page.locator(`label:has-text("${optionName}"), text="${optionName}"`).first();
            if (await optionElement.isVisible({ timeout: 1000 }).catch(() => false)) {
              await optionElement.click();
              await page.waitForTimeout(300);
            }
          }
        }
        await page.waitForTimeout(500);
      }

      // Click Add to Cart button (retry if still disabled)
      for (let attempt = 0; attempt < 3; attempt++) {
        const stillDisabled = await addBtn.evaluate(el => (el as HTMLButtonElement).disabled).catch(() => false);
        if (!stillDisabled) break;

        console.log(`  Attempt ${attempt + 1}: Add still disabled, trying to find missing selection...`);
        const firstRadio = page.locator('input[type="radio"]:not(:checked)').first();
        if (await firstRadio.isVisible({ timeout: 500 }).catch(() => false)) {
          await firstRadio.click();
          await page.waitForTimeout(500);
        }
      }

      await addBtn.click({ timeout: 10000 });
      console.log(`  Added to cart`);
      await page.waitForTimeout(1500);

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

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const cartBtn = page.locator('[class*="cart"], button:has-text("Cart"), button:has-text("View Order")').first();
    if (await cartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const checkoutBtn = page.locator('button:has-text("Checkout"), a:has-text("Checkout"), button:has-text("Continue")').first();
    await checkoutBtn.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

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
      return { success: true, message: 'Dry run successful - order reached payment stage', stage: 'complete' };
    }

    if (declined) {
      return { success: false, message: 'Payment was declined', stage: 'payment' };
    }

    // Scrape confirmation page for tracking info
    console.log('\nStep 8: Scraping confirmation page...');
    const confirmation = await scrapeConfirmationPage(page);

    return {
      success: true,
      message: 'Order submitted successfully',
      stage: 'complete',
      orderId: confirmation.confirmationNumber,
      confirmation
    };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('\nOrder agent error:', msg);
    return { success: false, message: `Order failed: ${msg}`, stage: currentStage };
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}
