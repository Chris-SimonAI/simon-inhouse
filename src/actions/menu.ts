import { db } from "@/db";
import { 
  menus, 
  menuGroups, 
  menuItems, 
  modifierGroups, 
  modifierOptions,
  dineInRestaurants 
} from "@/db/schemas";
import { eq, desc } from "drizzle-orm";
import { createSuccess, createError } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";

// Type definitions for the complete menu structure
export interface MenuOption {
  id: string;
  name: string;
  description: string;
  price: number;
  calories: number;
  isDefault: boolean;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  description: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  isMultiSelect: boolean;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  calories: number;
  imageUrl: string;
  allergens: string[];
  modifierGroups: MenuModifierGroup[];
}

export interface MenuGroup {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  items: MenuItem[];
}

export interface MenuData {
  restaurantId: number;
  restaurantGuid: string;
  restaurantName: string;
  groups: MenuGroup[];
}

/**
 * Fetches the complete menu for a restaurant by restaurant ID using joins
 */
export async function getCompleteMenuByRestaurant(
  identifier: { id: number } | { guid: string }
): Promise<CreateSuccess<MenuData> | CreateError<string[]>> {
  try {
    // Single query with all joins to get complete menu data
    const whereCondition =
      "id" in identifier
        ? eq(dineInRestaurants.id, identifier.id)
        : eq(dineInRestaurants.restaurantGuid, identifier.guid);

    const result = await db
      .select({
        // Restaurant data
        restaurantId: dineInRestaurants.id,
        restaurantGuid: dineInRestaurants.restaurantGuid,
        restaurantName: dineInRestaurants.name,
        // Menu data
        menuId: menus.id,
        menuName: menus.name,
        menuDescription: menus.description,
        // Menu group data
        menuGroupId: menuGroups.id,
        menuGroupGuid: menuGroups.menuGroupGuid,
        menuGroupName: menuGroups.name,
        menuGroupDescription: menuGroups.description,
        menuGroupImageUrls: menuGroups.imageUrls,
        // Menu item data
        menuItemId: menuItems.id,
        menuItemGuid: menuItems.menuItemGuid,
        menuItemName: menuItems.name,
        menuItemDescription: menuItems.description,
        menuItemPrice: menuItems.price,
        menuItemCalories: menuItems.calories,
        menuItemImageUrls: menuItems.imageUrls,
        menuItemAllergens: menuItems.allergens,
        menuItemSortOrder: menuItems.sortOrder,
        // Modifier group data
        modifierGroupId: modifierGroups.id,
        modifierGroupGuid: modifierGroups.modifierGroupGuid,
        modifierGroupName: modifierGroups.name,
        modifierGroupDescription: modifierGroups.description,
        modifierGroupMinSelections: modifierGroups.minSelections,
        modifierGroupMaxSelections: modifierGroups.maxSelections,
        modifierGroupIsRequired: modifierGroups.isRequired,
        modifierGroupIsMultiSelect: modifierGroups.isMultiSelect,
        // Modifier option data
        modifierOptionId: modifierOptions.id,
        modifierOptionGuid: modifierOptions.modifierOptionGuid,
        modifierOptionName: modifierOptions.name,
        modifierOptionDescription: modifierOptions.description,
        modifierOptionPrice: modifierOptions.price,
        modifierOptionCalories: modifierOptions.calories,
        modifierOptionIsDefault: modifierOptions.isDefault,
      })
      .from(dineInRestaurants)
      .leftJoin(menus, eq(menus.restaurantId, dineInRestaurants.id))
      .leftJoin(menuGroups, eq(menuGroups.menuId, menus.id))
      .leftJoin(menuItems, eq(menuItems.menuGroupId, menuGroups.id))
      .leftJoin(modifierGroups, eq(modifierGroups.menuItemId, menuItems.id))
      .leftJoin(modifierOptions, eq(modifierOptions.modifierGroupId, modifierGroups.id))
      .where(whereCondition)
      .orderBy(desc(menuItems.sortOrder));

    if (result.length === 0) {
      return createError("Restaurant not found");
    }

    // Check if restaurant has a menu
    const firstRow = result[0];
    if (!firstRow.menuId) {
      return createError("Menu not found for this restaurant");
    }

    // Process the flat result into nested structure
    const menuData: MenuData = {
      restaurantId: firstRow.restaurantId,
      restaurantGuid: firstRow.restaurantGuid,
      restaurantName: firstRow.restaurantName,
      groups: [],
    };

    // Group the data by menu groups
    const groupsMap = new Map<string, MenuGroup>();
    const itemsMap = new Map<string, MenuItem>();
    const modifierGroupsMap = new Map<string, MenuModifierGroup>();
    const optionsMap = new Map<string, MenuOption[]>();

    for (const row of result) {
      // Process menu group
      if (row.menuGroupId && row.menuGroupGuid && !groupsMap.has(row.menuGroupGuid)) {
        groupsMap.set(row.menuGroupGuid, {
          id: row.menuGroupGuid,
          name: row.menuGroupName || "",
          description: row.menuGroupDescription || "",
          imageUrl: row.menuGroupImageUrls?.[0] || "",
          items: [],
        });
      }

      // Process menu item
      if (row.menuItemId && row.menuItemGuid && !itemsMap.has(row.menuItemGuid)) {
        itemsMap.set(row.menuItemGuid, {
          id: row.menuItemGuid,
          name: row.menuItemName || "",
          description: row.menuItemDescription || "",
          price: parseFloat(row.menuItemPrice || "0"),
          calories: row.menuItemCalories || 0,
          imageUrl: row.menuItemImageUrls?.[0] || "",
          allergens: row.menuItemAllergens || [],
          modifierGroups: [],
        });
      }

      // Process modifier group
      if (row.modifierGroupId && row.modifierGroupGuid && !modifierGroupsMap.has(row.modifierGroupGuid)) {
        modifierGroupsMap.set(row.modifierGroupGuid, {
          id: row.modifierGroupGuid,
          name: row.modifierGroupName || "",
          description: row.modifierGroupDescription || "",
          minSelections: row.modifierGroupMinSelections || 0,
          maxSelections: row.modifierGroupMaxSelections || 1,
          isRequired: row.modifierGroupIsRequired || false,
          isMultiSelect: row.modifierGroupIsMultiSelect || false,
          options: [],
        });
      }

      // Process modifier option
      if (row.modifierOptionId && row.modifierOptionGuid && row.modifierGroupGuid) {
        const option: MenuOption = {
          id: row.modifierOptionGuid,
          name: row.modifierOptionName || "",
          description: row.modifierOptionDescription || "",
          price: parseFloat(row.modifierOptionPrice || "0"),
          calories: row.modifierOptionCalories || 0,
          isDefault: row.modifierOptionIsDefault || false,
        };

        if (!optionsMap.has(row.modifierGroupGuid)) {
          optionsMap.set(row.modifierGroupGuid, []);
        }
        
        // Avoid duplicates
        const existingOptions = optionsMap.get(row.modifierGroupGuid)!;
        if (!existingOptions.find(opt => opt.id === option.id)) {
          existingOptions.push(option);
        }
      }
    }

    for (const [groupId, group] of groupsMap) {
      for (const [itemId, item] of itemsMap) {
        const itemRow = result.find(r => r.menuItemGuid === itemId && r.menuGroupGuid === groupId);
        if (itemRow) {
          // Add modifier groups to this item
          for (const [modifierGroupId, modifierGroup] of modifierGroupsMap) {
            const modifierGroupRow = result.find(r => 
              r.modifierGroupGuid === modifierGroupId && 
              r.menuItemGuid === itemId
            );
            if (modifierGroupRow) {
              modifierGroup.options = optionsMap.get(modifierGroupId) || [];
              item.modifierGroups.push(modifierGroup);
            }
          }
          group.items.push(item);
        }
      }
      menuData.groups.push(group);
    }

    return createSuccess(menuData);
  } catch (error) {
    console.error("Error in getCompleteMenuByRestaurantId:", error);
    return createError("Failed to fetch complete menu");
  }
}
