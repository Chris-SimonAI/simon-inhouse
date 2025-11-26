import { db } from '@/db';
import { menuGroups, menuItems, menus, modifierGroups, modifierOptions } from '@/db/schemas';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createError, createSuccess } from '@/lib/utils';
import type { CreateError, CreateSuccess } from '@/types/response';
import { MenuMarkupInput } from '@/validations/menu-markup';

type ApplyMenuMarkupResult = {
  menuId: number;
  updatedItems: number;
  updatedOptions: number;
  markupPercent: number;
};

export async function applyMenuMarkup(input: MenuMarkupInput): Promise<CreateSuccess<ApplyMenuMarkupResult> | CreateError<string[]>> {
  try {
    const { restaurantId, markupPercent } = input;

    // Find latest menu by version desc
    const [latestMenu] = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(desc(menus.version))
      .limit(1);

    if (!latestMenu) {
      return createError('No menu found for restaurant');
    }

    const menuId = latestMenu.id;
    const factor = 1 + markupPercent / 100;

    const result = await db.transaction(async (tx) => {
      // Update menu metadata to store markupPercent (merge with previous metadata)
      const currentMetadata = latestMenu.metadata ?? {};
      const nextMetadata = { ...currentMetadata, markupPercent };
      await tx.update(menus).set({ metadata: nextMetadata }).where(eq(menus.id, menuId));

      // Get all menu groups for this menu
      const groupRows = await tx
        .select({ id: menuGroups.id })
        .from(menuGroups)
        .where(eq(menuGroups.menuId, menuId));
      const groupIds = groupRows.map((g) => g.id);

      // no groups, nothing to update
      if (groupIds.length === 0) {
        return { updatedItems: 0, updatedOptions: 0 };
      }

      // Update menu items with non-null originalPrice
      const updatedMenuItems = await tx
        .update(menuItems)
        .set({
          price: sql`ROUND(${menuItems.originalPrice} * ${factor}, 2)`,
        })
        .where(
          and(
            inArray(menuItems.menuGroupId, groupIds),
            sql`${menuItems.originalPrice} IS NOT NULL`
          )
        )
        .returning({ id: menuItems.id });
      const updatedItems = updatedMenuItems.length;

      // Use updated item ids to reach modifier groups
      const itemIds = updatedMenuItems.map((i) => i.id);

      // no items, only items were updated
      if (itemIds.length === 0) {
        return { updatedItems, updatedOptions: 0 };
      }

      // Find modifier groups for these items
      const modGroupRows = await tx
        .select({ id: modifierGroups.id })
        .from(modifierGroups)
        .where(inArray(modifierGroups.menuItemId, itemIds));
      const modGroupIds = modGroupRows.map((g) => g.id);

      //  no modifier groups, nothing to update for options
      if (modGroupIds.length === 0) {
        return { updatedItems, updatedOptions: 0 };
      }

      // Update modifier options with non-null originalPrice
      const updatedModOptions = await tx
        .update(modifierOptions)
        .set({
          price: sql`ROUND(${modifierOptions.originalPrice} * ${factor}, 2)`,
        })
        .where(
          and(
            inArray(modifierOptions.modifierGroupId, modGroupIds),
            sql`${modifierOptions.originalPrice} IS NOT NULL`
          )
        )
        .returning({ id: modifierOptions.id });
      const updatedOptions = updatedModOptions.length;

      return { updatedItems, updatedOptions };
    });

    return createSuccess({
      menuId,
      updatedItems: result.updatedItems,
      updatedOptions: result.updatedOptions,
      markupPercent,
    });
  } catch (error) {
    console.error('Error in applyMenuMarkup:', error);
    return createError('Failed to apply menu markup');
  }
}


