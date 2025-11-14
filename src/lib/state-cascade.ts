import { db } from "@/db";
import { menus, menuGroups, menuItems, modifierGroups, modifierOptions, dineInRestaurants } from "@/db/schemas";
import { eq, and, ne } from "drizzle-orm";
import type { EntityType, EntityStatus } from "@/actions/menu";

/**
 * Cascades status changes to child entities
 * Only cascades when status is 'approved' - 'archived' does not cascade
 */
export async function cascadeStatusToChildren(
  entityType: EntityType,
  entityId: number,
  status: EntityStatus
): Promise<void> {
  // Only cascade for 'approved' status
  if (status !== "approved") {
    return;
  }

  switch (entityType) {
    case "menu": {
      // Cascade to menu groups
      await db
        .update(menuGroups)
        .set({ status: "approved" })
        .where(
          and(
            eq(menuGroups.menuId, entityId),
            eq(menuGroups.status, "pending")
          )
        );
      
      // Then cascade to menu items (recursively)
      const menuGroupsResult = await db
        .select({ id: menuGroups.id })
        .from(menuGroups)
        .where(eq(menuGroups.menuId, entityId));
      
      for (const group of menuGroupsResult) {
        await cascadeStatusToChildren("menu_group", group.id, status);
      }
      break;
    }

    case "menu_group": {
      // Cascade to menu items
      await db
        .update(menuItems)
        .set({ status: "approved" })
        .where(
          and(
            eq(menuItems.menuGroupId, entityId),
            eq(menuItems.status, "pending")
          )
        );
      
      // Then cascade to modifier groups (recursively)
      const menuItemsResult = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(eq(menuItems.menuGroupId, entityId));
      
      for (const item of menuItemsResult) {
        await cascadeStatusToChildren("menu_item", item.id, status);
      }
      break;
    }

    case "menu_item": {
      // Cascade to modifier groups
      await db
        .update(modifierGroups)
        .set({ status: "approved" })
        .where(
          and(
            eq(modifierGroups.menuItemId, entityId),
            eq(modifierGroups.status, "pending")
          )
        );
      
      // Then cascade to modifier options (recursively)
      const modifierGroupsResult = await db
        .select({ id: modifierGroups.id })
        .from(modifierGroups)
        .where(eq(modifierGroups.menuItemId, entityId));
      
      for (const group of modifierGroupsResult) {
        await cascadeStatusToChildren("modifier_group", group.id, status);
      }
      break;
    }

    case "modifier_group": {
      // Cascade to modifier options
      await db
        .update(modifierOptions)
        .set({ status: "approved" })
        .where(
          and(
            eq(modifierOptions.modifierGroupId, entityId),
            eq(modifierOptions.status, "pending")
          )
        );
      break;
    }

    case "modifier_option":
      // No children to cascade to
      break;

    case "restaurant":
      // Cascade to menus
      await db
        .update(menus)
        .set({ status: "approved" })
        .where(
          and(
            eq(menus.restaurantId, entityId),
            eq(menus.status, "pending")
          )
        );
      
      // Then cascade to menu groups (recursively)
      const menusResult = await db
        .select({ id: menus.id })
        .from(menus)
        .where(eq(menus.restaurantId, entityId));
      
      for (const menu of menusResult) {
        await cascadeStatusToChildren("menu", menu.id, status);
      }
      break;
  }
}

/**
 * Handles version management when approving a menu
 * Archives the old approved version and sets the new one to approved
 */
export async function handleMenuVersionApproval(
  menuId: number
): Promise<void> {
  // Get the menu to approve
  const menuToApprove = await db
    .select()
    .from(menus)
    .where(eq(menus.id, menuId))
    .limit(1);

  if (menuToApprove.length === 0) {
    throw new Error("Menu not found");
  }

  const menu = menuToApprove[0];

  // If this menu is being approved, archive the old approved version
  if (menu.status === "pending" && menu.restaurantId) {
    // Find current approved menu for this restaurant
    const existingApproved = await db
      .select()
      .from(menus)
      .where(
        and(
          eq(menus.restaurantId, menu.restaurantId),
          eq(menus.status, "approved"),
          ne(menus.id, menuId)
        )
      )
      .limit(1);

    if (existingApproved.length > 0) {
      // Archive the old approved menu
      await db
        .update(menus)
        .set({ status: "archived" })
        .where(eq(menus.id, existingApproved[0].id));
    }
  }
}

