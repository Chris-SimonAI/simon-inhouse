import { NextResponse } from "next/server";
import { db } from "@/db";
import { hotelDiningDiscounts, hotels } from "@/db/schemas";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";

/**
 * POST /api/dining-discount
 * Request a dining discount for the current user/hotel from session.
 *
 * ============================================================================
 * WHY THIS IS AN API ROUTE INSTEAD OF A SERVER ACTION
 * ============================================================================
 *
 * This endpoint exists as an API route rather than using the server action
 * in `src/actions/dining-discounts.ts` because of a critical interaction issue
 * between server actions and the `useRscChat` hook in client components.
 *
 * THE PROBLEM:
 * When calling a server action (like `requestDiningDiscount()`) from a client
 * component's onClick handler, it interferes with other state updates and
 * function calls in the same handler - specifically the `sendMessage` function
 * from `useRscChat`. The exact cause is unclear but likely related to:
 *
 * 1. Server actions use React's internal mechanisms for state transitions
 * 2. The `useRscChat` hook also manages complex async state (streaming, etc.)
 * 3. When both run in the same event handler, there's a context collision
 *    that causes `sendMessage` to fail silently or throw errors
 *
 * ATTEMPTED FIXES THAT DIDN'T WORK:
 * - Using `await` vs fire-and-forget patterns
 * - Using `.then()/.catch()` instead of async/await
 * - Using `setTimeout(..., 0)` to defer state updates
 * - Reordering the calls (discount first vs message first)
 *
 * THE SOLUTION:
 * By using a standard `fetch()` call to an API route instead of a server action,
 * we completely decouple the discount request from React's rendering cycle.
 * The fetch is just a plain HTTP request that doesn't interact with React's
 * internal state management, allowing `sendMessage` and other state updates
 * to work correctly.
 *
 * USAGE:
 * ```tsx
 * // In chatbot.tsx onClick handler:
 * // 1. Update UI state immediately (these work fine)
 * setOpenL1(true);
 * sendMessage("...", { inputType: 'text' });
 *
 * // 2. Request discount via fetch (doesn't block or interfere)
 * const res = await fetch("/api/dining-discount", { method: "POST" });
 * const result = await res.json();
 * // Show toast based on result
 * ```
 * ============================================================================
 */
export async function POST() {
  try {
    const currentSession = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });

    if (!currentSession) {
      return NextResponse.json(
        { ok: false, message: "No active session found" },
        { status: 401 }
      );
    }

    const { hotelId, userId } = currentSession.session;

    if (!hotelId || !userId) {
      return NextResponse.json(
        { ok: false, message: "Invalid session - missing hotel or user" },
        { status: 400 }
      );
    }

    // Fetch hotel to get the discount percentage
    const hotel = await db
      .select({ restaurantDiscount: hotels.restaurantDiscount })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);

    if (hotel.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Hotel not found" },
        { status: 404 }
      );
    }

    const discountPercent = hotel[0].restaurantDiscount;

    // Check for existing discount
    const existing = await db
      .select()
      .from(hotelDiningDiscounts)
      .where(
        and(
          eq(hotelDiningDiscounts.hotelId, hotelId),
          eq(hotelDiningDiscounts.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const existingDiscount = existing[0];
      if (existingDiscount.status === "redeemed") {
        return NextResponse.json(
          { ok: false, message: "Discount already redeemed" },
          { status: 400 }
        );
      }
      // Already requested, return existing with discount percentage
      return NextResponse.json({
        ok: true,
        data: { ...existingDiscount, discountPercent },
      });
    }

    // Create new discount
    const newDiscount = await db
      .insert(hotelDiningDiscounts)
      .values({
        hotelId,
        userId,
        status: "requested",
      })
      .returning();

    return NextResponse.json({
      ok: true,
      data: { ...newDiscount[0], discountPercent },
    });
  } catch (error) {
    console.error("Error requesting dining discount:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to request discount" },
      { status: 500 }
    );
  }
}

