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
import { createError, createSuccess } from "@/lib/utils";
import type { CreateError, CreateSuccess } from "@/types/response";
import type { MenuImportPayload } from "@/validations/menu-import";
import { eq } from "drizzle-orm";

type ImportResult = {
  restaurantId: number;
  menuIds: number[];
  menuGroupCount: number;
  menuItemCount: number;
  modifierGroupCount: number;
  modifierOptionCount: number;
};

const pickFirst = <T>(...values: Array<T | undefined>) =>
  values.find((value) => value !== undefined);

const toDecimalString = (value: string | number | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "number" ? value.toFixed(2) : value;
};

const toDate = (value: string | Date | undefined) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export async function importMenuPayload(
  payload: MenuImportPayload
): Promise<CreateSuccess<ImportResult> | CreateError<string[]>> {
  try {
    const result = await db.transaction(async (tx) => {
      const restaurantGuid = pickFirst(
        payload.restaurant.restaurantGuid,
        payload.restaurant.id
      );

      if (!restaurantGuid) {
        throw new Error("restaurantGuid is required");
      }

      const restaurantValues: typeof dineInRestaurants.$inferInsert = {
        hotelId: payload.hotelId,
        restaurantGuid,
        name: payload.restaurant.name,
      };

      const restaurantImageUrls = pickFirst(
        payload.restaurant.imageUrls,
        payload.restaurant.images
      );
      const businessHours = pickFirst(
        payload.restaurant.businessHours,
        payload.restaurant.schedules
      );

      if (payload.restaurant.description !== undefined) {
        restaurantValues.description = payload.restaurant.description;
      }
      if (payload.restaurant.cuisine !== undefined) {
        restaurantValues.cuisine = payload.restaurant.cuisine;
      }
      if (restaurantImageUrls !== undefined) {
        restaurantValues.imageUrls = restaurantImageUrls;
      }
      if (payload.restaurant.rating !== undefined) {
        restaurantValues.rating = toDecimalString(payload.restaurant.rating);
      }
      if (payload.restaurant.addressLine1 !== undefined) {
        restaurantValues.addressLine1 = payload.restaurant.addressLine1;
      }
      if (payload.restaurant.address_line1 !== undefined) {
        restaurantValues.addressLine1 = payload.restaurant.address_line1;
      }
      if (payload.restaurant.addressLine2 !== undefined) {
        restaurantValues.addressLine2 = payload.restaurant.addressLine2;
      }
      if (payload.restaurant.address_line2 !== undefined) {
        restaurantValues.addressLine2 = payload.restaurant.address_line2;
      }
      if (payload.restaurant.city !== undefined) {
        restaurantValues.city = payload.restaurant.city;
      }
      if (payload.restaurant.state !== undefined) {
        restaurantValues.state = payload.restaurant.state;
      }
      if (payload.restaurant.zipCode !== undefined) {
        restaurantValues.zipCode = payload.restaurant.zipCode;
      }
      if (payload.restaurant.zip_code !== undefined) {
        restaurantValues.zipCode = payload.restaurant.zip_code;
      }
      if (payload.restaurant.country !== undefined) {
        restaurantValues.country = payload.restaurant.country;
      }
      if (payload.restaurant.phoneNumber !== undefined) {
        restaurantValues.phoneNumber = payload.restaurant.phoneNumber;
      }
      if (payload.restaurant.phone_number !== undefined) {
        restaurantValues.phoneNumber = payload.restaurant.phone_number;
      }
      if (payload.restaurant.deliveryFee !== undefined) {
        restaurantValues.deliveryFee = toDecimalString(payload.restaurant.deliveryFee);
      }
      if (payload.restaurant.serviceFeePercent !== undefined) {
        restaurantValues.serviceFeePercent = toDecimalString(
          payload.restaurant.serviceFeePercent
        );
      }
      if (payload.restaurant.showTips !== undefined) {
        restaurantValues.showTips = payload.restaurant.showTips;
      }
      if (businessHours !== undefined) {
        restaurantValues.businessHours = businessHours;
      }
      if (payload.restaurant.metadata !== undefined) {
        restaurantValues.metadata = payload.restaurant.metadata;
      }

      const [restaurantRow] = await tx
        .insert(dineInRestaurants)
        .values(restaurantValues)
        .returning({ id: dineInRestaurants.id });

      if (!restaurantRow) {
        throw new Error("Failed to create restaurant");
      }

      const menuIds: number[] = [];
      let menuGroupCount = 0;
      let menuItemCount = 0;
      let modifierGroupCount = 0;
      let modifierOptionCount = 0;

      for (const menu of payload.menus) {
        const menuGuid = pickFirst(menu.menuGuid, menu.id);
        if (!menuGuid) {
          throw new Error("menuGuid is required");
        }

        const menuValues: typeof menus.$inferInsert = {
          restaurantId: restaurantRow.id,
          menuGuid,
          name: menu.name,
        };

        if (menu.description !== undefined) {
          menuValues.description = menu.description;
        }
        if (menu.imageUrls !== undefined) {
          menuValues.imageUrls = menu.imageUrls;
        } else if (menu.images !== undefined) {
          menuValues.imageUrls = menu.images;
        }
        const lastUpdated = toDate(menu.lastUpdated);
        if (lastUpdated) {
          menuValues.lastUpdated = lastUpdated;
        }
        if (menu.metadata !== undefined) {
          menuValues.metadata = menu.metadata;
        }

        const [menuRow] = await tx
          .insert(menus)
          .values(menuValues)
          .returning({ id: menus.id });

        if (!menuRow) {
          throw new Error(`Failed to create menu "${menu.name}"`);
        }

        menuIds.push(menuRow.id);

        for (const group of menu.groups) {
          const groupValues: typeof menuGroups.$inferInsert = {
            menuId: menuRow.id,
            menuGroupGuid: group.menuGroupGuid,
            name: group.name,
          };

          if (group.description !== undefined) {
            groupValues.description = group.description;
          }
          if (group.imageUrls !== undefined) {
            groupValues.imageUrls = group.imageUrls;
          } else if (group.image !== undefined) {
            groupValues.imageUrls = [group.image];
          }
          if (group.sortOrder !== undefined) {
            groupValues.sortOrder = group.sortOrder;
          }
          if (group.metadata !== undefined) {
            groupValues.metadata = group.metadata;
          }

          const [groupRow] = await tx
            .insert(menuGroups)
            .values(groupValues)
            .returning({ id: menuGroups.id });

          if (!groupRow) {
            throw new Error(`Failed to create menu group "${group.name}"`);
          }

          menuGroupCount += 1;

          for (const item of group.items) {
            const itemValues: typeof menuItems.$inferInsert = {
              menuGroupId: groupRow.id,
              menuItemGuid: item.menuItemGuid,
              name: item.name,
            };

            if (item.description !== undefined) {
              itemValues.description = item.description;
            }
            if (item.price !== undefined) {
              itemValues.price = toDecimalString(item.price);
            }
            if (item.originalPrice !== undefined) {
              itemValues.originalPrice = toDecimalString(item.originalPrice);
            }
            if (item.calories !== undefined) {
              itemValues.calories = item.calories;
            }
            if (item.imageUrls !== undefined) {
              itemValues.imageUrls = item.imageUrls;
            } else if (item.images !== undefined) {
              itemValues.imageUrls = item.images;
            }
            if (item.allergens !== undefined) {
              itemValues.allergens = item.allergens;
            }
            if (item.sortOrder !== undefined) {
              itemValues.sortOrder = item.sortOrder;
            }
            if (item.isAvailable !== undefined) {
              itemValues.isAvailable = item.isAvailable;
            }
            if (item.metadata !== undefined) {
              itemValues.metadata = item.metadata;
            }

            const [itemRow] = await tx
              .insert(menuItems)
              .values(itemValues)
              .returning({ id: menuItems.id });

            if (!itemRow) {
              throw new Error(`Failed to create menu item "${item.name}"`);
            }

            menuItemCount += 1;
            const modifierGroupIdsForItem: number[] = [];

            for (const modifierGroup of item.modifierGroups ?? []) {
              const modGroupValues: typeof modifierGroups.$inferInsert = {
                menuItemId: itemRow.id,
                modifierGroupGuid: modifierGroup.modifierGroupGuid,
                name: modifierGroup.name,
              };

              if (modifierGroup.description !== undefined) {
                modGroupValues.description = modifierGroup.description;
              }
              if (modifierGroup.minSelections !== undefined) {
                modGroupValues.minSelections = modifierGroup.minSelections;
              }
              if (modifierGroup.maxSelections !== undefined) {
                modGroupValues.maxSelections = modifierGroup.maxSelections;
              }
              if (modifierGroup.isRequired !== undefined) {
                modGroupValues.isRequired = modifierGroup.isRequired;
              }
              if (modifierGroup.isMultiSelect !== undefined) {
                modGroupValues.isMultiSelect = modifierGroup.isMultiSelect;
              }
              if (modifierGroup.metadata !== undefined) {
                modGroupValues.metadata = modifierGroup.metadata;
              }

              const [modGroupRow] = await tx
                .insert(modifierGroups)
                .values(modGroupValues)
                .returning({ id: modifierGroups.id });

              if (!modGroupRow) {
                throw new Error(
                  `Failed to create modifier group "${modifierGroup.name}"`
                );
              }

              modifierGroupCount += 1;
              modifierGroupIdsForItem.push(modGroupRow.id);

              const optionIds: number[] = [];
              for (const option of modifierGroup.options ?? []) {
                const optionValues: typeof modifierOptions.$inferInsert = {
                  modifierGroupId: modGroupRow.id,
                  modifierOptionGuid: option.modifierOptionGuid,
                  name: option.name,
                  modifierGroupReferences: [modGroupRow.id],
                };

                if (option.description !== undefined) {
                  optionValues.description = option.description;
                }
                if (option.price !== undefined) {
                  optionValues.price = toDecimalString(option.price);
                }
                if (option.originalPrice !== undefined) {
                  optionValues.originalPrice = toDecimalString(option.originalPrice);
                }
                if (option.calories !== undefined) {
                  optionValues.calories = option.calories;
                }
                if (option.isDefault !== undefined) {
                  optionValues.isDefault = option.isDefault;
                }
                if (option.isAvailable !== undefined) {
                  optionValues.isAvailable = option.isAvailable;
                }
                if (option.metadata !== undefined) {
                  optionValues.metadata = option.metadata;
                }

                const [optionRow] = await tx
                  .insert(modifierOptions)
                  .values(optionValues)
                  .returning({ id: modifierOptions.id });

                if (!optionRow) {
                  throw new Error(
                    `Failed to create modifier option "${option.name}"`
                  );
                }

                modifierOptionCount += 1;
                optionIds.push(optionRow.id);
              }

              if (optionIds.length > 0) {
                await tx
                  .update(modifierGroups)
                  .set({ modifierOptionsReferences: optionIds })
                  .where(eq(modifierGroups.id, modGroupRow.id));
              }
            }

            if (modifierGroupIdsForItem.length > 0) {
              await tx
                .update(menuItems)
                .set({ modifierGroupsReferences: modifierGroupIdsForItem })
                .where(eq(menuItems.id, itemRow.id));
            }
          }
        }
      }

      return {
        restaurantId: restaurantRow.id,
        menuIds,
        menuGroupCount,
        menuItemCount,
        modifierGroupCount,
        modifierOptionCount,
      };
    });

    return createSuccess(result);
  } catch (error) {
    console.error("Error in importMenuPayload:", error);
    return createError("Failed to import menu payload");
  }
}
