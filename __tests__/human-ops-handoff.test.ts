import { describe, expect, it } from 'vitest';
import { buildCanonicalOrderArtifact } from '@/lib/orders/canonical-order-artifact';
import { buildHumanOpsHandoffPayload } from '@/lib/orders/human-ops-handoff-shared';

describe('buildHumanOpsHandoffPayload', () => {
  it('prefers canonical artifact items when present', () => {
    const canonicalOrder = buildCanonicalOrderArtifact(
      [
        {
          menuItemId: 1,
          menuItemGuid: '11111111-1111-1111-1111-111111111111',
          itemName: 'Burger',
          itemDescription: '',
          basePrice: 10,
          modifierPrice: 2,
          unitPrice: 12,
          quantity: 2,
          totalPrice: 24,
          modifierDetails: [
            {
              groupId: '22222222-2222-2222-2222-222222222222',
              groupName: 'Size',
              options: [
                {
                  optionId: '33333333-3333-3333-3333-333333333333',
                  optionName: 'Large',
                  optionPrice: '2.00',
                },
              ],
            },
          ],
        },
      ],
      24,
    );

    const payload = buildHumanOpsHandoffPayload({
      reason: 'bot_failed',
      orderId: 42,
      orderStatus: 'requested_to_toast',
      failureStage: 'checkout',
      failureMessage: 'Cloudflare challenge',
      guest: {
        name: 'Chris Simon',
        phone: '+15550001111',
        email: 'chris@example.com',
        roomNumber: '412',
      },
      hotel: {
        id: 7,
        name: 'Test Hotel',
        address: '123 Main St, Los Angeles, CA 90001',
      },
      restaurant: {
        id: 9,
        name: 'Bludsos',
        sourceUrl: 'https://www.toasttab.com/local/order/bludsos-bbq-santamonica',
      },
      metadata: { canonicalOrder },
      fallbackItems: [{ name: 'Fallback Burger', quantity: 1, modifiers: [] }],
      adminBaseUrl: 'https://app.example.com',
    });

    expect(payload.items).toEqual([
      {
        name: 'Burger',
        quantity: 2,
        modifiers: ['Large'],
      },
    ]);
    expect(payload.compiler.compilerVersion).toBe('canonical-v1');
    expect(payload.compiler.itemCount).toBe(1);
  });

  it('falls back to bot payload items when canonical artifact is missing', () => {
    const payload = buildHumanOpsHandoffPayload({
      reason: 'bot_error',
      orderId: 43,
      orderStatus: 'requested_to_toast',
      guest: {
        name: 'Max',
        phone: '+15550002222',
        email: 'max@example.com',
        roomNumber: '205',
      },
      hotel: {
        id: 8,
        name: 'Fallback Hotel',
        address: '500 Ocean Ave, Santa Monica, CA 90401',
      },
      restaurant: {
        id: 10,
        name: 'Pizza Place',
        sourceUrl: 'https://example.com/order',
      },
      metadata: {},
      fallbackItems: [
        { name: 'Pepperoni Pizza', quantity: 1, modifiers: ['Extra cheese'] },
      ],
      adminBaseUrl: 'https://app.example.com',
    });

    expect(payload.items).toEqual([
      { name: 'Pepperoni Pizza', quantity: 1, modifiers: ['Extra cheese'] },
    ]);
    expect(payload.compiler.compilerVersion).toBe('unknown');
    expect(payload.compiler.itemCount).toBe(1);
  });
});
