import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  dineInRestaurants,
  menuItems,
  modifierGroups,
  modifierOptions,
} from '@/db/schemas';
import { createError, createSuccess } from '@/lib/utils';
import {
  compileOrderWithCatalog,
  type CanonicalCompileResult,
} from '@/lib/orders/canonical-order-compiler';
import type { SecureOrderItem } from '@/validations/dine-in-orders';

export interface CanonicalCompileServerResult extends CanonicalCompileResult {
  restaurantId: number;
  hotelId: number | null;
  deliveryFee: number;
  serviceFeePercent: number;
}

export async function compileCanonicalOrderRequest(
  restaurantGuid: string,
  items: SecureOrderItem[],
) {
  try {
    const [restaurant] = await db
      .select({
        id: dineInRestaurants.id,
        hotelId: dineInRestaurants.hotelId,
        deliveryFee: dineInRestaurants.deliveryFee,
        serviceFeePercent: dineInRestaurants.serviceFeePercent,
      })
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.restaurantGuid, restaurantGuid))
      .limit(1);

    if (!restaurant) {
      return createError('Restaurant not found');
    }

    const deliveryFee = Number.parseFloat(restaurant.deliveryFee);
    if (!Number.isFinite(deliveryFee)) {
      return createError('Restaurant delivery fee is invalid');
    }

    const serviceFeePercent = Number.parseFloat(restaurant.serviceFeePercent);
    if (!Number.isFinite(serviceFeePercent)) {
      return createError('Restaurant service fee percent is invalid');
    }

    const menuItemGuids = Array.from(
      new Set(items.map((item) => item.menuItemGuid)),
    );

    const catalogMenuItems =
      menuItemGuids.length === 0
        ? []
        : await db
            .select({
              id: menuItems.id,
              menuItemGuid: menuItems.menuItemGuid,
              name: menuItems.name,
              description: menuItems.description,
              price: menuItems.price,
            })
            .from(menuItems)
            .where(
              and(
                inArray(menuItems.menuItemGuid, menuItemGuids),
                eq(menuItems.status, 'approved'),
                eq(menuItems.isAvailable, true),
              ),
            );

    const menuItemIds = catalogMenuItems.map((menuItem) => menuItem.id);
    const catalogModifierGroups =
      menuItemIds.length === 0
        ? []
        : await db
            .select({
              id: modifierGroups.id,
              modifierGroupGuid: modifierGroups.modifierGroupGuid,
              menuItemId: modifierGroups.menuItemId,
              name: modifierGroups.name,
              minSelections: modifierGroups.minSelections,
              maxSelections: modifierGroups.maxSelections,
              isRequired: modifierGroups.isRequired,
              isMultiSelect: modifierGroups.isMultiSelect,
            })
            .from(modifierGroups)
            .where(
              and(
                inArray(modifierGroups.menuItemId, menuItemIds),
                eq(modifierGroups.status, 'approved'),
              ),
            );

    const modifierGroupIds = catalogModifierGroups.map((group) => group.id);
    const catalogModifierOptions =
      modifierGroupIds.length === 0
        ? []
        : await db
            .select({
              id: modifierOptions.id,
              modifierOptionGuid: modifierOptions.modifierOptionGuid,
              modifierGroupId: modifierOptions.modifierGroupId,
              name: modifierOptions.name,
              price: modifierOptions.price,
            })
            .from(modifierOptions)
            .where(
              and(
                inArray(modifierOptions.modifierGroupId, modifierGroupIds),
                eq(modifierOptions.status, 'approved'),
                eq(modifierOptions.isAvailable, true),
              ),
            );

    const compileResult = compileOrderWithCatalog(items, {
      menuItems: catalogMenuItems,
      modifierGroups: catalogModifierGroups,
      modifierOptions: catalogModifierOptions,
    });

    return createSuccess({
      ...compileResult,
      restaurantId: restaurant.id,
      hotelId: restaurant.hotelId,
      deliveryFee,
      serviceFeePercent,
    } satisfies CanonicalCompileServerResult);
  } catch (error) {
    console.error('Error compiling canonical order request:', error);
    return createError('Failed to compile order');
  }
}
