'use server';

import { db } from "@/db";
import { dineInRestaurants, menus, menuGroups, menuItems, modifierGroups, modifierOptions, dineInOrders, dineInOrderItems } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";

/**
 * Get all restaurants for a hotel (admin - includes all statuses)
 */
export async function getRestaurantsForHotel(hotelId: number) {
  try {
    const restaurants = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.hotelId, hotelId))
      .orderBy(dineInRestaurants.name);

    return createSuccess(restaurants);
  } catch (error) {
    console.error("Error in getRestaurantsForHotel:", error);
    return createError("Failed to fetch restaurants");
  }
}

/**
 * Get a single restaurant by ID
 */
export async function getRestaurantById(id: number) {
  try {
    const [restaurant] = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, id));

    if (!restaurant) {
      return createError("Restaurant not found");
    }

    return createSuccess(restaurant);
  } catch (error) {
    console.error("Error in getRestaurantById:", error);
    return createError("Failed to fetch restaurant");
  }
}

/**
 * Update restaurant status (pending, approved, archived)
 */
export async function updateRestaurantStatus(id: number, status: "pending" | "approved" | "archived") {
  try {
    const [updated] = await db
      .update(dineInRestaurants)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(dineInRestaurants.id, id))
      .returning();

    if (!updated) {
      return createError("Restaurant not found");
    }

    return createSuccess(updated);
  } catch (error) {
    console.error("Error in updateRestaurantStatus:", error);
    return createError("Failed to update restaurant status");
  }
}

/**
 * Update restaurant details
 */
export async function updateRestaurant(id: number, data: {
  name?: string;
  description?: string;
  cuisine?: string;
  deliveryFee?: string;
  serviceFeePercent?: string;
  showTips?: boolean;
}) {
  try {
    const [updated] = await db
      .update(dineInRestaurants)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(dineInRestaurants.id, id))
      .returning();

    if (!updated) {
      return createError("Restaurant not found");
    }

    return createSuccess(updated);
  } catch (error) {
    console.error("Error in updateRestaurant:", error);
    return createError("Failed to update restaurant");
  }
}

/**
 * Get menu for a restaurant with all groups and items
 */
export async function getMenuForRestaurant(restaurantId: number) {
  try {
    // Get the approved menu for this restaurant
    const [menu] = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(menus.version)
      .limit(1);

    if (!menu) {
      return createSuccess({ menu: null, groups: [] });
    }

    // Get all menu groups
    const groups = await db
      .select()
      .from(menuGroups)
      .where(eq(menuGroups.menuId, menu.id))
      .orderBy(menuGroups.sortOrder);

    // Get all menu items for these groups
    const groupIds = groups.map(g => g.id);

    if (groupIds.length === 0) {
      return createSuccess({ menu, groups: [] });
    }

    const items = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.menuGroupId, groupIds[0])); // This is simplified

    // Get items for all groups
    const allItems = await Promise.all(
      groups.map(async (group) => {
        const groupItems = await db
          .select()
          .from(menuItems)
          .where(eq(menuItems.menuGroupId, group.id))
          .orderBy(menuItems.sortOrder);

        return {
          ...group,
          items: groupItems
        };
      })
    );

    return createSuccess({ menu, groups: allItems });
  } catch (error) {
    console.error("Error in getMenuForRestaurant:", error);
    return createError("Failed to fetch menu");
  }
}

/**
 * Delete a restaurant and all associated data (cascading)
 */
export async function deleteRestaurant(id: number) {
  try {
    // First, delete any orders and order items for this restaurant
    const restaurantOrders = await db
      .select()
      .from(dineInOrders)
      .where(eq(dineInOrders.restaurantId, id));

    for (const order of restaurantOrders) {
      // Delete order items first
      await db
        .delete(dineInOrderItems)
        .where(eq(dineInOrderItems.orderId, order.id));
    }

    // Delete orders
    await db
      .delete(dineInOrders)
      .where(eq(dineInOrders.restaurantId, id));

    // Next, get all menus for this restaurant
    const restaurantMenus = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, id));

    for (const menu of restaurantMenus) {
      // Get all menu groups for this menu
      const groups = await db
        .select()
        .from(menuGroups)
        .where(eq(menuGroups.menuId, menu.id));

      for (const group of groups) {
        // Get all menu items for this group
        const items = await db
          .select()
          .from(menuItems)
          .where(eq(menuItems.menuGroupId, group.id));

        for (const item of items) {
          // Get all modifier groups for this item
          const modGroups = await db
            .select()
            .from(modifierGroups)
            .where(eq(modifierGroups.menuItemId, item.id));

          for (const modGroup of modGroups) {
            // Delete modifier options
            await db
              .delete(modifierOptions)
              .where(eq(modifierOptions.modifierGroupId, modGroup.id));
          }

          // Delete modifier groups
          await db
            .delete(modifierGroups)
            .where(eq(modifierGroups.menuItemId, item.id));
        }

        // Delete menu items
        await db
          .delete(menuItems)
          .where(eq(menuItems.menuGroupId, group.id));
      }

      // Delete menu groups
      await db
        .delete(menuGroups)
        .where(eq(menuGroups.menuId, menu.id));
    }

    // Delete menus
    await db
      .delete(menus)
      .where(eq(menus.restaurantId, id));

    // Now delete the restaurant
    const [deleted] = await db
      .delete(dineInRestaurants)
      .where(eq(dineInRestaurants.id, id))
      .returning();

    if (!deleted) {
      return createError("Restaurant not found");
    }

    return createSuccess(deleted);
  } catch (error) {
    console.error("Error in deleteRestaurant:", error);
    return createError("Failed to delete restaurant");
  }
}

/**
 * Get menu item with its modifier groups and options
 */
export async function getMenuItemWithModifiers(itemId: number) {
  try {
    const [item] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId));

    if (!item) {
      return createError("Menu item not found");
    }

    // Get modifier groups for this item
    const groups = await db
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.menuItemId, itemId))
      .orderBy(modifierGroups.name);

    // Get options for each group
    const groupsWithOptions = await Promise.all(
      groups.map(async (group) => {
        const options = await db
          .select()
          .from(modifierOptions)
          .where(eq(modifierOptions.modifierGroupId, group.id))
          .orderBy(modifierOptions.name);

        return {
          ...group,
          options,
        };
      })
    );

    return createSuccess({
      item,
      modifierGroups: groupsWithOptions,
    });
  } catch (error) {
    console.error("Error in getMenuItemWithModifiers:", error);
    return createError("Failed to fetch menu item");
  }
}

/**
 * Toggle menu item availability (in/out of stock)
 */
export async function toggleMenuItemAvailability(itemId: number) {
  try {
    const [item] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId));

    if (!item) {
      return createError("Menu item not found");
    }

    const [updated] = await db
      .update(menuItems)
      .set({
        isAvailable: !item.isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(menuItems.id, itemId))
      .returning();

    return createSuccess(updated);
  } catch (error) {
    console.error("Error in toggleMenuItemAvailability:", error);
    return createError("Failed to update menu item");
  }
}

/**
 * Toggle modifier option availability (in/out of stock)
 */
export async function toggleModifierOptionAvailability(optionId: number) {
  try {
    const [option] = await db
      .select()
      .from(modifierOptions)
      .where(eq(modifierOptions.id, optionId));

    if (!option) {
      return createError("Modifier option not found");
    }

    const [updated] = await db
      .update(modifierOptions)
      .set({
        isAvailable: !option.isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(modifierOptions.id, optionId))
      .returning();

    return createSuccess(updated);
  } catch (error) {
    console.error("Error in toggleModifierOptionAvailability:", error);
    return createError("Failed to update modifier option");
  }
}

/**
 * Update menu item price
 */
export async function updateMenuItemPrice(itemId: number, price: string) {
  try {
    const [updated] = await db
      .update(menuItems)
      .set({
        price,
        updatedAt: new Date(),
      })
      .where(eq(menuItems.id, itemId))
      .returning();

    if (!updated) {
      return createError("Menu item not found");
    }

    return createSuccess(updated);
  } catch (error) {
    console.error("Error in updateMenuItemPrice:", error);
    return createError("Failed to update menu item price");
  }
}
