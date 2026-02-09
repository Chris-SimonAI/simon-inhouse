import { NextRequest, NextResponse } from "next/server";
import { scrapeMenu } from "@/lib/bot/menu-scraper";
import { db } from "@/db";
import { dineInRestaurants, menus, menuGroups, menuItems, modifierGroups, modifierOptions } from "@/db/schemas";
import { createError, createSuccess } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for scraping

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, hotelId, restaurantId, skipModifiers = false } = body;

    // For new restaurant: url required, hotelId optional (can add to library without hotel)
    // For rescrape: url and restaurantId required
    if (!url) {
      return NextResponse.json(
        createError("url is required"),
        { status: 400 }
      );
    }

    const isRescrape = !!restaurantId;
    console.log(`Starting ${isRescrape ? 'rescrape' : 'scrape'} for ${url}...`);

    // Scrape the menu WITH modifiers by default
    const scrapedMenu = await scrapeMenu(url, { skipModifiers });

    console.log(`Scraped ${scrapedMenu.items.length} items from ${scrapedMenu.restaurantName}`);

    let restaurant;

    if (isRescrape) {
      // Update existing restaurant
      const [existingRestaurant] = await db
        .select()
        .from(dineInRestaurants)
        .where(eq(dineInRestaurants.id, Number(restaurantId)));

      if (!existingRestaurant) {
        return NextResponse.json(createError("Restaurant not found"), { status: 404 });
      }

      // Update restaurant with new data
      const [updatedRestaurant] = await db
        .update(dineInRestaurants)
        .set({
          name: scrapedMenu.restaurantName,
          imageUrls: scrapedMenu.heroImage ? [scrapedMenu.heroImage] : existingRestaurant.imageUrls,
          businessHours: scrapedMenu.hours || existingRestaurant.businessHours,
          // Update address fields
          addressLine1: scrapedMenu.address?.addressLine1 || existingRestaurant.addressLine1,
          addressLine2: scrapedMenu.address?.addressLine2 || existingRestaurant.addressLine2,
          city: scrapedMenu.address?.city || existingRestaurant.city,
          state: scrapedMenu.address?.state || existingRestaurant.state,
          zipCode: scrapedMenu.address?.zipCode || existingRestaurant.zipCode,
          country: scrapedMenu.address?.country || existingRestaurant.country,
          phoneNumber: scrapedMenu.address?.phoneNumber || existingRestaurant.phoneNumber,
          latitude: scrapedMenu.address?.latitude?.toString() || existingRestaurant.latitude,
          longitude: scrapedMenu.address?.longitude?.toString() || existingRestaurant.longitude,
          metadata: {
            ...((existingRestaurant.metadata as object) || {}),
            sourceUrl: url,
            scrapedAt: scrapedMenu.scrapedAt,
            lastRescrape: new Date().toISOString(),
            deliveryEta: scrapedMenu.deliveryEta || null,
          },
          updatedAt: new Date(),
        })
        .where(eq(dineInRestaurants.id, Number(restaurantId)))
        .returning();

      restaurant = updatedRestaurant;

      // Delete old menu data
      const existingMenus = await db.select().from(menus).where(eq(menus.restaurantId, restaurant.id));
      for (const menu of existingMenus) {
        const groups = await db.select().from(menuGroups).where(eq(menuGroups.menuId, menu.id));
        for (const group of groups) {
          const items = await db.select().from(menuItems).where(eq(menuItems.menuGroupId, group.id));
          for (const item of items) {
            const modGroups = await db.select().from(modifierGroups).where(eq(modifierGroups.menuItemId, item.id));
            for (const modGroup of modGroups) {
              await db.delete(modifierOptions).where(eq(modifierOptions.modifierGroupId, modGroup.id));
            }
            await db.delete(modifierGroups).where(eq(modifierGroups.menuItemId, item.id));
          }
          await db.delete(menuItems).where(eq(menuItems.menuGroupId, group.id));
        }
        await db.delete(menuGroups).where(eq(menuGroups.menuId, menu.id));
      }
      await db.delete(menus).where(eq(menus.restaurantId, restaurant.id));

      console.log(`Updated restaurant: ${restaurant.id} - ${restaurant.name}`);
    } else {
      // Create new restaurant (hotelId is optional - can add directly to library)
      const restaurantGuid = uuidv4();
      const sourceDescription = url.includes("chownow.com")
        ? "Menu scraped from ChowNow"
        : "Menu scraped from Toast";
      const [newRestaurant] = await db.insert(dineInRestaurants).values({
        hotelId: hotelId ? Number(hotelId) : null,
        restaurantGuid,
        name: scrapedMenu.restaurantName,
        description: sourceDescription,
        imageUrls: scrapedMenu.heroImage ? [scrapedMenu.heroImage] : [],
        status: "pending",
        deliveryFee: "5.00",
        serviceFeePercent: "20.00",
        showTips: true,
        businessHours: scrapedMenu.hours || null,
        // Address fields
        addressLine1: scrapedMenu.address?.addressLine1 || null,
        addressLine2: scrapedMenu.address?.addressLine2 || null,
        city: scrapedMenu.address?.city || null,
        state: scrapedMenu.address?.state || null,
        zipCode: scrapedMenu.address?.zipCode || null,
        country: scrapedMenu.address?.country || null,
        phoneNumber: scrapedMenu.address?.phoneNumber || null,
        latitude: scrapedMenu.address?.latitude?.toString() || null,
        longitude: scrapedMenu.address?.longitude?.toString() || null,
        metadata: {
          sourceUrl: url,
          scrapedAt: scrapedMenu.scrapedAt,
          deliveryEta: scrapedMenu.deliveryEta || null,
        },
      }).returning();

      restaurant = newRestaurant;
      console.log(`Created restaurant: ${restaurant.id} - ${restaurant.name}`);
    }

    // Create menu record
    const menuGuid = uuidv4();
    const [menu] = await db.insert(menus).values({
      restaurantId: restaurant.id,
      menuGuid,
      name: "Main Menu",
      status: "approved",
      version: 1,
    }).returning();

    console.log(`Created menu: ${menu.id}`);

    // Group items by category and create menu groups
    const itemsByCategory = new Map<string, typeof scrapedMenu.items>();
    for (const item of scrapedMenu.items) {
      const category = item.category || "Menu";
      if (!itemsByCategory.has(category)) {
        itemsByCategory.set(category, []);
      }
      itemsByCategory.get(category)!.push(item);
    }

    let totalItemsCreated = 0;
    let totalModifierGroupsCreated = 0;
    let totalModifierOptionsCreated = 0;
    let sortOrder = 0;

    for (const [categoryName, categoryItems] of itemsByCategory) {
      // Create menu group
      const [group] = await db.insert(menuGroups).values({
        menuId: menu.id,
        menuGroupGuid: uuidv4(),
        name: categoryName,
        sortOrder: sortOrder++,
        status: "approved",
      }).returning();

      // Create menu items
      let itemSortOrder = 0;
      for (const item of categoryItems) {
        const [createdItem] = await db.insert(menuItems).values({
          menuGroupId: group.id,
          menuItemGuid: uuidv4(),
          name: item.name,
          description: item.description || null,
          price: item.price.toFixed(2),
          imageUrls: item.image ? [item.image] : [],
          sortOrder: itemSortOrder++,
          isAvailable: true,
          status: "approved",
        }).returning();

        totalItemsCreated++;

        // Create modifier groups and options for this item
        if (item.modifierGroups && item.modifierGroups.length > 0) {
          for (const modGroup of item.modifierGroups) {
            const [createdModGroup] = await db.insert(modifierGroups).values({
              menuItemId: createdItem.id,
              modifierGroupGuid: uuidv4(),
              name: modGroup.name,
              isRequired: modGroup.required,
              minSelections: modGroup.minSelections,
              maxSelections: modGroup.maxSelections,
              isMultiSelect: modGroup.maxSelections > 1,
              status: "approved",
            }).returning();

            totalModifierGroupsCreated++;

            // Create modifier options
            for (const option of modGroup.options) {
              await db.insert(modifierOptions).values({
                modifierGroupId: createdModGroup.id,
                modifierOptionGuid: uuidv4(),
                name: option.name,
                price: option.price.toFixed(2),
                isDefault: false,
                isAvailable: true,
                status: "approved",
              });
              totalModifierOptionsCreated++;
            }
          }
        }
      }
    }

    console.log(`Created ${totalItemsCreated} menu items in ${itemsByCategory.size} categories`);
    console.log(`Created ${totalModifierGroupsCreated} modifier groups with ${totalModifierOptionsCreated} options`);

    return NextResponse.json(createSuccess({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        guid: restaurant.restaurantGuid,
      },
      menu: {
        id: menu.id,
        itemCount: totalItemsCreated,
        categories: Array.from(itemsByCategory.keys()),
      },
      modifiers: {
        groupCount: totalModifierGroupsCreated,
        optionCount: totalModifierOptionsCreated,
      },
    }));

  } catch (error) {
    console.error("Error in POST /api/bot/scrape:", error);
    const message = error instanceof Error ? error.message : "Failed to scrape menu";
    return NextResponse.json(createError(message), { status: 500 });
  }
}
