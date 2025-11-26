import "server-only";
import { db } from "@/db";
import {
  dineInRestaurants,
  menus,
  menuGroups,
  menuItems,
  modifierGroups,
  modifierOptions,
} from "@/db/schemas";
import type {
  DineInRestaurant,
  Menu as MenuRow,
  MenuGroup as MenuGroupRow,
  MenuItem as MenuItemRow,
  ModifierGroup as ModifierGroupRow,
  ModifierOption as ModifierOptionRow,
} from "@/db/schemas";
import { desc, eq } from "drizzle-orm";
import { cascadeStatusToChildren, handleMenuVersionApproval } from "@/lib/state-cascade";
import { createError, createSuccess } from "@/lib/utils";
import type { CreateError, CreateSuccess } from "@/types/response";

export type EntityType =
  | "restaurant"
  | "menu"
  | "menu_group"
  | "menu_item"
  | "modifier_group"
  | "modifier_option";

export type EntityStatus = "pending" | "approved" | "archived";

// Admin shapes
export type AdminMenuData = MenuRow & {
  groups: Array<
    MenuGroupRow & {
      items: Array<
        MenuItemRow & {
          modifierGroups: Array<ModifierGroupRow & { options: ModifierOptionRow[] }>;
        }
      >;
    }
  >;
};

export type AdminRestaurantData = {
  restaurant: DineInRestaurant;
  menus: AdminMenuData[];
};

type EntityUnion =
  | DineInRestaurant
  | MenuRow
  | MenuGroupRow
  | MenuItemRow
  | ModifierGroupRow
  | ModifierOptionRow;

type EntityDataMap = {
  restaurant: Partial<DineInRestaurant>;
  menu: Partial<MenuRow>;
  menu_group: Partial<MenuGroupRow>;
  menu_item: Partial<MenuItemRow>;
  modifier_group: Partial<ModifierGroupRow>;
  modifier_option: Partial<ModifierOptionRow>;
};

/**
 * Get complete restaurant data for admin (includes all statuses)
 */
export async function getRestaurantDataForAdmin(
  restaurantId: number
): Promise<CreateSuccess<AdminRestaurantData> | CreateError<string[]>> {
  try {
    const restaurant = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, restaurantId))
      .limit(1);

    if (restaurant.length === 0) {
      return createError("Restaurant not found");
    }

    // Get only the latest version of the menu for this restaurant
    const latestMenuRow = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(desc(menus.version))
      .limit(1);

    if (latestMenuRow.length === 0) {
      return createError("No menu found for this restaurant");
    }

    const latestMenu = latestMenuRow[0];

    // Get menu groups for the latest menu
    const menuGroupsData = await db
      .select()
      .from(menuGroups)
      .where(eq(menuGroups.menuId, latestMenu.id));

    const groupsData = [];
    for (const group of menuGroupsData) {
      // Get menu items
      const menuItemsData = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.menuGroupId, group.id));

      const itemsData = [];
      for (const item of menuItemsData) {
        // Get modifier groups
        const modifierGroupsData = await db
          .select()
          .from(modifierGroups)
          .where(eq(modifierGroups.menuItemId, item.id));

        const modifierGroupsDataWithOptions = [];
        for (const modifierGroup of modifierGroupsData) {
          // Get modifier options
          const modifierOptionsData = await db
            .select()
            .from(modifierOptions)
            .where(eq(modifierOptions.modifierGroupId, modifierGroup.id));

          modifierGroupsDataWithOptions.push({
            ...modifierGroup,
            options: modifierOptionsData,
          });
        }

        itemsData.push({
          ...item,
          modifierGroups: modifierGroupsDataWithOptions,
        });
      }

      groupsData.push({
        ...group,
        items: itemsData,
      });
    }

    return createSuccess({
      restaurant: restaurant[0],
      menus: [
        {
          ...latestMenu,
          groups: groupsData,
        },
      ],
    });
  } catch (error) {
    console.error("Error in getRestaurantDataForAdmin:", error);
    return createError("Failed to fetch restaurant data");
  }
}

/**
 * Get single entity data by type and ID
 */
export async function getEntityData(
  entityType: EntityType,
  entityId: number
): Promise<CreateSuccess<EntityUnion> | CreateError<string[]>> {
  try {
    let entity;

    switch (entityType) {
      case "restaurant":
        entity = await db
          .select()
          .from(dineInRestaurants)
          .where(eq(dineInRestaurants.id, entityId))
          .limit(1);
        break;
      case "menu":
        entity = await db.select().from(menus).where(eq(menus.id, entityId)).limit(1);
        break;
      case "menu_group":
        entity = await db.select().from(menuGroups).where(eq(menuGroups.id, entityId)).limit(1);
        break;
      case "menu_item":
        entity = await db.select().from(menuItems).where(eq(menuItems.id, entityId)).limit(1);
        break;
      case "modifier_group":
        entity = await db
          .select()
          .from(modifierGroups)
          .where(eq(modifierGroups.id, entityId))
          .limit(1);
        break;
      case "modifier_option":
        entity = await db
          .select()
          .from(modifierOptions)
          .where(eq(modifierOptions.id, entityId))
          .limit(1);
        break;
      default:
        return createError("Invalid entity type");
    }

    if (!entity || entity.length === 0) {
      return createError("Entity not found");
    }

    return createSuccess(entity[0]);
  } catch (error) {
    console.error("Error in getEntityData:", error);
    return createError("Failed to fetch entity data");
  }
}

/**
 * Update entity state and/or data
 */
export async function updateEntityStateAndData(
  entityType: EntityType,
  entityId: number,
  status?: EntityStatus,
  data?: EntityDataMap[EntityType],
  skipCascade?: boolean
): Promise<CreateSuccess<EntityUnion> | CreateError<string[]>> {
  try {
    // Validate that data updates are only for pending entities
    if (data) {
      let currentEntity;
      switch (entityType) {
        case "restaurant":
          currentEntity = await db
            .select()
            .from(dineInRestaurants)
            .where(eq(dineInRestaurants.id, entityId))
            .limit(1);
          break;
        case "menu":
          currentEntity = await db.select().from(menus).where(eq(menus.id, entityId)).limit(1);
          break;
        case "menu_group":
          currentEntity = await db.select().from(menuGroups).where(eq(menuGroups.id, entityId)).limit(1);
          break;
        case "menu_item":
          currentEntity = await db.select().from(menuItems).where(eq(menuItems.id, entityId)).limit(1);
          break;
        case "modifier_group":
          currentEntity = await db
            .select()
            .from(modifierGroups)
            .where(eq(modifierGroups.id, entityId))
            .limit(1);
          break;
        case "modifier_option":
          currentEntity = await db
            .select()
            .from(modifierOptions)
            .where(eq(modifierOptions.id, entityId))
            .limit(1);
          break;
        default:
          return createError("Invalid entity type");
      }

      if (!currentEntity || currentEntity.length === 0) {
        return createError("Entity not found");
      }

      if (currentEntity[0].status !== "pending") {
        return createError("Data updates are only allowed for pending entities");
      }
    }

    // Update data if provided
    if (data) {
      switch (entityType) {
        case "restaurant":
          await db.update(dineInRestaurants).set(data).where(eq(dineInRestaurants.id, entityId));
          break;
        case "menu":
          await db.update(menus).set(data).where(eq(menus.id, entityId));
          break;
        case "menu_group":
          await db.update(menuGroups).set(data).where(eq(menuGroups.id, entityId));
          break;
        case "menu_item":
          await db.update(menuItems).set(data).where(eq(menuItems.id, entityId));
          break;
        case "modifier_group":
          await db.update(modifierGroups).set(data).where(eq(modifierGroups.id, entityId));
          break;
        case "modifier_option":
          await db.update(modifierOptions).set(data).where(eq(modifierOptions.id, entityId));
          break;
      }
    }

    // Update status if provided
    if (status) {
      switch (entityType) {
        case "restaurant":
          await db
            .update(dineInRestaurants)
            .set({ status })
            .where(eq(dineInRestaurants.id, entityId));
          break;
        case "menu":
          // Handle version management BEFORE updating status
          if (status === "approved") {
            await handleMenuVersionApproval(entityId);
          }
          await db.update(menus).set({ status }).where(eq(menus.id, entityId));
          break;
        case "menu_group":
          await db.update(menuGroups).set({ status }).where(eq(menuGroups.id, entityId));
          break;
        case "menu_item":
          await db.update(menuItems).set({ status }).where(eq(menuItems.id, entityId));
          break;
        case "modifier_group":
          await db.update(modifierGroups).set({ status }).where(eq(modifierGroups.id, entityId));
          break;
        case "modifier_option":
          await db
            .update(modifierOptions)
            .set({ status })
            .where(eq(modifierOptions.id, entityId));
          break;
      }

      // Cascade status to children if approved (unless skipCascade is true)
      if (status === "approved" && !skipCascade) {
        await cascadeStatusToChildren(entityType, entityId);
      }
    }

    // Return updated entity
    return getEntityData(entityType, entityId);
  } catch (error) {
    console.error("Error in updateEntityStateAndData:", error);
    return createError("Failed to update entity");
  }
}

/**
 * Bulk update entities
 */
export async function bulkUpdateEntities(
  restaurantId: number,
  operations: Array<{
    entityType: EntityType;
    entityId: number;
    status?: EntityStatus;
    data?: EntityDataMap[EntityType];
  }>
): Promise<CreateSuccess<{ updated: EntityUnion[] }> | CreateError<string[]>> {
  try {
    const results = [];

    for (const operation of operations) {
      const result = await updateEntityStateAndData(
        operation.entityType,
        operation.entityId,
        operation.status,
        operation.data
      );

      if (!result.ok) {
        return result;
      }

      results.push(result.data);
    }

    return createSuccess({ updated: results });
  } catch (error) {
    console.error("Error in bulkUpdateEntities:", error);
    return createError("Failed to bulk update entities");
  }
}

/**
 * Helper to filter out system fields that shouldn't be updated
 */
function filterUpdateableFields(obj: Record<string, unknown>): Record<string, unknown> {
  const systemFields = [
    "id",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
    "status",
    "groups",
    "items",
    "modifierGroups",
    "options",
    "restaurantId",
    "menuId",
    "menuGroupId",
    "menuItemId",
    "modifierGroupId",
  ];
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!systemFields.includes(key) && value !== undefined) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Update restaurant data in the same format as getRestaurantDataForAdmin
 * Accepts the nested structure and updates all entities recursively
 */
export async function updateRestaurantDataInFormat(
  restaurantId: number,
  data: {
    restaurant?: { status?: EntityStatus } & Record<string, unknown>;
    menus?: Array<{
      id: number;
      status?: EntityStatus;
      [key: string]: unknown;
      groups?: Array<{
        id: number;
        status?: EntityStatus;
        [key: string]: unknown;
        items?: Array<{
          id: number;
          status?: EntityStatus;
          [key: string]: unknown;
          modifierGroups?: Array<{
            id: number;
            status?: EntityStatus;
            [key: string]: unknown;
            options?: Array<{
              id: number;
              status?: EntityStatus;
              [key: string]: unknown;
            }>;
          }>;
        }>;
      }>;
    }>;
  }
): Promise<
  CreateSuccess<{ updated: Array<{ type: string; id: number }>; count: number }> | CreateError<string[]>
> {
  try {
    const updated = [];

    // Update restaurant if provided
    if (data.restaurant) {
      const { status, ...restaurantData } = data.restaurant;
      const filteredData = filterUpdateableFields(restaurantData);
      const result = await updateEntityStateAndData(
        "restaurant",
        restaurantId,
        status,
        Object.keys(filteredData).length > 0 ? filteredData : undefined,
        true // skipCascade: true for bulk updates
      );
      if (!result.ok) {
        return result;
      }
      updated.push({ type: "restaurant", id: restaurantId });
    }

    // Process menus
    if (data.menus) {
      for (const menu of data.menus) {
        if (!menu.id) {
          return createError(`Menu missing id`);
        }

        const { status: menuStatus, groups, ...menuData } = menu;
        const filteredMenuData = filterUpdateableFields(menuData);
        const result = await updateEntityStateAndData(
          "menu",
          menu.id,
          menuStatus,
          Object.keys(filteredMenuData).length > 0 ? filteredMenuData : undefined,
          true // skipCascade: true for bulk updates
        );
        if (!result.ok) {
          return result;
        }
        updated.push({ type: "menu", id: menu.id });

        // Process menu groups
        if (groups) {
          for (const group of groups) {
            if (!group.id) {
              return createError(`Menu group missing id`);
            }

            const { status: groupStatus, items, ...groupData } = group;
            const filteredGroupData = filterUpdateableFields(groupData);
            const groupResult = await updateEntityStateAndData(
              "menu_group",
              group.id,
              groupStatus,
              Object.keys(filteredGroupData).length > 0 ? filteredGroupData : undefined,
              true // skipCascade: true for bulk updates
            );
            if (!groupResult.ok) {
              return groupResult;
            }
            updated.push({ type: "menu_group", id: group.id });

            // Process menu items
            if (items) {
              for (const item of items) {
                if (!item.id) {
                  return createError(`Menu item missing id`);
                }

                const { status: itemStatus, modifierGroups, ...itemData } = item;
                const filteredItemData = filterUpdateableFields(itemData);
                const itemResult = await updateEntityStateAndData(
                  "menu_item",
                  item.id,
                  itemStatus,
                  Object.keys(filteredItemData).length > 0 ? filteredItemData : undefined,
                  true // skipCascade: true for bulk updates
                );
                if (!itemResult.ok) {
                  return itemResult;
                }
                updated.push({ type: "menu_item", id: item.id });

                // Process modifier groups
                if (modifierGroups) {
                  for (const modifierGroup of modifierGroups) {
                    if (!modifierGroup.id) {
                      return createError(`Modifier group missing id`);
                    }

                    const { status: modGroupStatus, options, ...modGroupData } = modifierGroup;
                    const filteredModGroupData = filterUpdateableFields(modGroupData);
                    const modGroupResult = await updateEntityStateAndData(
                      "modifier_group",
                      modifierGroup.id,
                      modGroupStatus,
                      Object.keys(filteredModGroupData).length > 0 ? filteredModGroupData : undefined,
                      true // skipCascade: true for bulk updates
                    );
                    if (!modGroupResult.ok) {
                      return modGroupResult;
                    }
                    updated.push({ type: "modifier_group", id: modifierGroup.id });

                    // Process modifier options
                    if (options) {
                      for (const option of options) {
                        if (!option.id) {
                          return createError(`Modifier option missing id`);
                        }

                        const { status: optionStatus, ...optionData } = option;
                        const filteredOptionData = filterUpdateableFields(optionData);
                        const optionResult = await updateEntityStateAndData(
                          "modifier_option",
                          option.id,
                          optionStatus,
                          Object.keys(filteredOptionData).length > 0 ? filteredOptionData : undefined,
                          true // skipCascade: true for bulk updates
                        );
                        if (!optionResult.ok) {
                          return optionResult;
                        }
                        updated.push({ type: "modifier_option", id: option.id });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return createSuccess({ updated, count: updated.length });
  } catch (error) {
    console.error("Error in updateRestaurantDataInFormat:", error);
    return createError("Failed to update restaurant data");
  }
}


