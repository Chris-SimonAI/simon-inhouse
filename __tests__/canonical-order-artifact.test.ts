import { describe, expect, it } from 'vitest';
import {
  buildCanonicalOrderArtifact,
  extractCanonicalBotItems,
  extractCanonicalOrderArtifact,
} from '@/lib/orders/canonical-order-artifact';

describe('canonical-order-artifact', () => {
  it('builds and extracts canonical artifact from order metadata', () => {
    const artifact = buildCanonicalOrderArtifact(
      [
        {
          menuItemId: 10,
          menuItemGuid: '11111111-1111-1111-1111-111111111111',
          itemName: 'Burger',
          itemDescription: 'House burger',
          basePrice: 10,
          modifierPrice: 1.5,
          unitPrice: 11.5,
          quantity: 2,
          totalPrice: 23,
          modifierDetails: [
            {
              groupId: '22222222-2222-2222-2222-222222222222',
              groupName: 'Extras',
              options: [
                {
                  optionId: '33333333-3333-3333-3333-333333333333',
                  optionName: 'Cheese',
                  optionPrice: '1.50',
                },
              ],
            },
          ],
        },
      ],
      23,
    );

    const metadata = { canonicalOrder: artifact };
    const parsedArtifact = extractCanonicalOrderArtifact(metadata);
    const botItems = extractCanonicalBotItems(metadata);

    expect(parsedArtifact).not.toBeNull();
    expect(parsedArtifact?.status).toBe('ready_to_execute');
    expect(parsedArtifact?.itemCount).toBe(1);
    expect(botItems).toEqual([
      {
        itemName: 'Burger',
        quantity: 2,
        modifierDetails: [
          {
            groupId: '22222222-2222-2222-2222-222222222222',
            groupName: 'Extras',
            options: [
              {
                optionId: '33333333-3333-3333-3333-333333333333',
                optionName: 'Cheese',
                optionPrice: '1.50',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('returns null when metadata does not contain a valid canonical artifact', () => {
    expect(extractCanonicalOrderArtifact(null)).toBeNull();
    expect(extractCanonicalOrderArtifact({})).toBeNull();
    expect(extractCanonicalBotItems({ canonicalOrder: { status: 'ready_to_execute' } })).toBeNull();
  });
});
