import { NextRequest, NextResponse } from "next/server";
import { scrapeMenu } from "@/lib/bot/menu-scraper";
import { db } from "@/db";
import { dineInRestaurants, menus, menuGroups, menuItems, modifierGroups, modifierOptions } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max per request

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantId, skipModifiers = false } = body;

    // Get the restaurant
    const [restaurant] = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, Number(restaurantId)));

    if (!restaurant) {
      return NextResponse.json({ ok: false, message: "Restaurant not found" }, { status: 404 });
    }

    const sourceUrl = (restaurant.metadata as { sourceUrl?: string } | null)?.sourceUrl;
    if (!sourceUrl) {
      return NextResponse.json({
        ok: false,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        message: "No source URL",
      });
    }

    console.log(`[Mass Rescrape] Scraping ${restaurant.name}...`);

    try {
      // Scrape the menu
      const scrapedMenu = await scrapeMenu(sourceUrl, { skipModifiers });

      // Update restaurant with new data
      await db
        .update(dineInRestaurants)
        .set({
          name: scrapedMenu.restaurantName,
          imageUrls: scrapedMenu.heroImage ? [scrapedMenu.heroImage] : restaurant.imageUrls,
          businessHours: scrapedMenu.hours || restaurant.businessHours,
          addressLine1: scrapedMenu.address?.addressLine1 || restaurant.addressLine1,
          city: scrapedMenu.address?.city || restaurant.city,
          state: scrapedMenu.address?.state || restaurant.state,
          zipCode: scrapedMenu.address?.zipCode || restaurant.zipCode,
          metadata: {
            ...((restaurant.metadata as object) || {}),
            sourceUrl,
            scrapedAt: scrapedMenu.scrapedAt,
            lastRescrape: new Date().toISOString(),
            deliveryEta: scrapedMenu.deliveryEta || null,
          },
          updatedAt: new Date(),
        })
        .where(eq(dineInRestaurants.id, restaurant.id));

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

      // Create new menu
      const [menu] = await db.insert(menus).values({
        restaurantId: restaurant.id,
        menuGuid: uuidv4(),
        name: "Main Menu",
        status: "approved",
        version: 1,
      }).returning();

      // Group items by category
      const itemsByCategory = new Map<string, typeof scrapedMenu.items>();
      for (const item of scrapedMenu.items) {
        const category = item.category || "Menu";
        if (!itemsByCategory.has(category)) {
          itemsByCategory.set(category, []);
        }
        itemsByCategory.get(category)!.push(item);
      }

      let totalItemsCreated = 0;
      let sortOrder = 0;

      for (const [categoryName, categoryItems] of itemsByCategory) {
        const [group] = await db.insert(menuGroups).values({
          menuId: menu.id,
          menuGroupGuid: uuidv4(),
          name: categoryName,
          sortOrder: sortOrder++,
          status: "approved",
        }).returning();

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

          // Save modifier groups and options
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
              }
            }
          }
        }
      }

      console.log(`[Mass Rescrape] ✓ ${restaurant.name}: ${totalItemsCreated} items`);

      return NextResponse.json({
        ok: true,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        itemCount: totalItemsCreated,
        categories: Array.from(itemsByCategory.keys()),
      });
    } catch (scrapeError) {
      const message = scrapeError instanceof Error ? scrapeError.message : "Unknown error";
      console.log(`[Mass Rescrape] ✗ ${restaurant.name}: ${message}`);

      return NextResponse.json({
        ok: false,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        message,
      });
    }
  } catch (error) {
    console.error("Error in mass rescrape:", error);
    const message = error instanceof Error ? error.message : "Failed to process";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

// GET endpoint to fetch all restaurants that can be rescraped
export async function GET() {
  try {
    const restaurants = await db
      .select({
        id: dineInRestaurants.id,
        name: dineInRestaurants.name,
        metadata: dineInRestaurants.metadata,
      })
      .from(dineInRestaurants);

    // Filter to only those with source URLs
    const rescrapeableRestaurants = restaurants
      .filter(r => (r.metadata as { sourceUrl?: string } | null)?.sourceUrl)
      .map(r => ({
        id: r.id,
        name: r.name,
        sourceUrl: (r.metadata as { sourceUrl?: string }).sourceUrl,
      }));

    return NextResponse.json({
      ok: true,
      restaurants: rescrapeableRestaurants,
      total: rescrapeableRestaurants.length,
    });
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    return NextResponse.json({ ok: false, message: "Failed to fetch restaurants" }, { status: 500 });
  }
}
