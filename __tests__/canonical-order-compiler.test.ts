import { describe, expect, it } from 'vitest';
import { compileOrderWithCatalog } from '@/lib/orders/canonical-order-compiler';

const baseCatalog = {
  menuItems: [
    {
      id: 101,
      menuItemGuid: '11111111-1111-1111-1111-111111111111',
      name: 'Burger',
      description: 'House burger',
      price: '10.00',
    },
  ],
  modifierGroups: [
    {
      id: 201,
      modifierGroupGuid: '22222222-2222-2222-2222-222222222222',
      menuItemId: 101,
      name: 'Size',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      isMultiSelect: false,
    },
    {
      id: 202,
      modifierGroupGuid: '33333333-3333-3333-3333-333333333333',
      menuItemId: 101,
      name: 'Extras',
      minSelections: 0,
      maxSelections: 2,
      isRequired: false,
      isMultiSelect: true,
    },
  ],
  modifierOptions: [
    {
      id: 301,
      modifierOptionGuid: '44444444-4444-4444-4444-444444444444',
      modifierGroupId: 201,
      name: 'Regular',
      price: '0.00',
    },
    {
      id: 302,
      modifierOptionGuid: '55555555-5555-5555-5555-555555555555',
      modifierGroupId: 201,
      name: 'Large',
      price: '2.00',
    },
    {
      id: 303,
      modifierOptionGuid: '66666666-6666-6666-6666-666666666666',
      modifierGroupId: 202,
      name: 'Cheese',
      price: '1.50',
    },
  ],
};

describe('compileOrderWithCatalog', () => {
  it('returns ready_to_execute for a valid order', () => {
    const result = compileOrderWithCatalog(
      [
        {
          menuItemGuid: '11111111-1111-1111-1111-111111111111',
          quantity: 2,
          selectedModifiers: {
            '22222222-2222-2222-2222-222222222222': [
              '55555555-5555-5555-5555-555555555555',
            ],
          },
        },
      ],
      baseCatalog,
    );

    expect(result.status).toBe('ready_to_execute');
    expect(result.issues).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.unitPrice).toBe(12);
    expect(result.subtotal).toBe(24);
  });

  it('returns needs_user_input when a required modifier is missing', () => {
    const result = compileOrderWithCatalog(
      [
        {
          menuItemGuid: '11111111-1111-1111-1111-111111111111',
          quantity: 1,
          selectedModifiers: {},
        },
      ],
      baseCatalog,
    );

    expect(result.status).toBe('needs_user_input');
    expect(
      result.issues.some((issue) => issue.code === 'required_modifier_missing'),
    ).toBe(true);
  });

  it('returns unfulfillable when selected option is in the wrong group', () => {
    const result = compileOrderWithCatalog(
      [
        {
          menuItemGuid: '11111111-1111-1111-1111-111111111111',
          quantity: 1,
          selectedModifiers: {
            '22222222-2222-2222-2222-222222222222': [
              '66666666-6666-6666-6666-666666666666',
            ],
          },
        },
      ],
      baseCatalog,
    );

    expect(result.status).toBe('unfulfillable');
    expect(
      result.issues.some((issue) => issue.code === 'modifier_option_not_in_group'),
    ).toBe(true);
  });
});
