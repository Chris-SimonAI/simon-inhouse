import { NextRequest, NextResponse } from "next/server";
import { checkRestaurantStatus, RestaurantStatus } from "@/lib/bot/status-checker";
import { db } from "@/db";
import { dineInRestaurants } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute max for status check

// In-memory cache for status checks (5 minute TTL)
const statusCache = new Map<number, { status: RestaurantStatus; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/bot/status?restaurantId=123
 * Returns cached status if fresh, otherwise fetches new status
 */
export async function GET(request: NextRequest) {
  try {
    const restaurantId = request.nextUrl.searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json(
        createError("restaurantId is required"),
        { status: 400 }
      );
    }

    const id = Number(restaurantId);

    // Check cache first
    const cached = statusCache.get(id);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`Returning cached status for restaurant ${id}`);
      return NextResponse.json(createSuccess({
        ...cached.status,
        fromCache: true,
        cacheAge: Math.floor((Date.now() - cached.cachedAt) / 1000),
      }));
    }

    // Get restaurant from DB
    const [restaurant] = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, id));

    if (!restaurant) {
      return NextResponse.json(createError("Restaurant not found"), { status: 404 });
    }

    // Get source URL from metadata
    const sourceUrl = (restaurant.metadata as { sourceUrl?: string } | null)?.sourceUrl;

    if (!sourceUrl) {
      return NextResponse.json(
        createError("No source URL found for this restaurant"),
        { status: 400 }
      );
    }

    // Fetch fresh status
    const status = await checkRestaurantStatus(sourceUrl);

    // Update cache
    statusCache.set(id, { status, cachedAt: Date.now() });

    // Also update restaurant metadata with latest status
    await db
      .update(dineInRestaurants)
      .set({
        metadata: {
          ...((restaurant.metadata as object) || {}),
          lastStatus: {
            isOpen: status.isOpen,
            deliveryEta: status.deliveryEta,
            closedMessage: status.closedMessage,
            checkedAt: status.checkedAt,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(dineInRestaurants.id, id));

    return NextResponse.json(createSuccess({
      ...status,
      fromCache: false,
    }));
  } catch (error) {
    console.error("Error in GET /api/bot/status:", error);
    const message = error instanceof Error ? error.message : "Failed to check status";
    return NextResponse.json(createError(message), { status: 500 });
  }
}

/**
 * POST /api/bot/status
 * Batch check multiple restaurants
 * Body: { restaurantIds: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantIds } = body;

    if (!restaurantIds || !Array.isArray(restaurantIds)) {
      return NextResponse.json(
        createError("restaurantIds array is required"),
        { status: 400 }
      );
    }

    const results: Record<number, RestaurantStatus & { fromCache: boolean; error?: string }> = {};

    // Process each restaurant (could be parallelized with limits)
    for (const id of restaurantIds.slice(0, 10)) { // Limit to 10 at a time
      try {
        // Check cache first
        const cached = statusCache.get(id);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          results[id] = { ...cached.status, fromCache: true };
          continue;
        }

        // Get restaurant
        const [restaurant] = await db
          .select()
          .from(dineInRestaurants)
          .where(eq(dineInRestaurants.id, id));

        if (!restaurant) {
          results[id] = {
            isOpen: false,
            checkedAt: new Date().toISOString(),
            fromCache: false,
            error: "Restaurant not found",
          };
          continue;
        }

        const sourceUrl = (restaurant.metadata as { sourceUrl?: string } | null)?.sourceUrl;

        if (!sourceUrl) {
          results[id] = {
            isOpen: false,
            checkedAt: new Date().toISOString(),
            fromCache: false,
            error: "No source URL",
          };
          continue;
        }

        // Fetch status
        const status = await checkRestaurantStatus(sourceUrl);
        statusCache.set(id, { status, cachedAt: Date.now() });
        results[id] = { ...status, fromCache: false };

      } catch (err) {
        results[id] = {
          isOpen: false,
          checkedAt: new Date().toISOString(),
          fromCache: false,
          error: err instanceof Error ? err.message : "Check failed",
        };
      }
    }

    return NextResponse.json(createSuccess(results));
  } catch (error) {
    console.error("Error in POST /api/bot/status:", error);
    const message = error instanceof Error ? error.message : "Failed to check status";
    return NextResponse.json(createError(message), { status: 500 });
  }
}
