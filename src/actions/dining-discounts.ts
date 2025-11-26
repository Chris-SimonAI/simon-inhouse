"use server";

import "server-only";
import { db } from "@/db";
import { hotelDiningDiscounts, hotels } from "@/db/schemas";
import { eq, and } from "drizzle-orm";
import { getHotelSession } from "@/actions/sessions";
import { type HotelDiningDiscount } from "@/db/schemas/hotel-dining-discounts";
import { type CreateSuccess, type CreateError } from "@/types/response";
import { createSuccess, createError } from "@/lib/utils";

/** Response type that includes the discount percentage from the hotel */
export type DiscountWithPercentage = HotelDiningDiscount & {
  discountPercent: number;
};

/**
 * Request a new dining discount for the current user/hotel from session.
 * If the user already has an existing discount for this hotel:
 * - If "redeemed", reject (they already used one).
 * - If "requested", return the existing discount (idempotent).
 *
 * ============================================================================
 * WARNING: DO NOT USE THIS SERVER ACTION FROM THE CHATBOT COMPONENT
 * ============================================================================
 *
 * This server action should NOT be called from the chatbot's onClick handler.
 * There is a critical interaction issue between server actions and the
 * `useRscChat` hook that causes `sendMessage` to fail when a server action
 * is invoked in the same event handler.
 *
 * Instead, use the API route at `/api/dining-discount` via fetch():
 *
 * ```tsx
 * const res = await fetch("/api/dining-discount", { method: "POST" });
 * const result = await res.json();
 * ```
 *
 * See `/src/app/api/dining-discount/route.ts` for the full explanation.
 *
 * This server action is kept for potential use in other contexts (e.g., server
 * components, other server actions) where the useRscChat conflict doesn't apply.
 * ============================================================================
 */
export async function requestDiningDiscount(): Promise<
  CreateSuccess<DiscountWithPercentage> | CreateError<string[]>
> {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active session found");
    }

    const { hotelId, userId } = sessionResult.data;

    // Fetch hotel to get the discount percentage
    const hotel = await db
      .select({ restaurantDiscount: hotels.restaurantDiscount })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);

    if (hotel.length === 0) {
      return createError("Hotel not found");
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
        return createError("Discount already redeemed for this user");
      }
      // Already requested, return existing with discount percentage
      return createSuccess({ ...existingDiscount, discountPercent });
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

    return createSuccess({ ...newDiscount[0], discountPercent });
  } catch (error) {
    console.error("Error requesting dining discount:", error);
    return createError(
      error instanceof Error ? error.message : "Failed to request discount"
    );
  }
}

/**
 * Get the active (requested, not yet redeemed) discount for the current user/hotel.
 * Returns null data if no active discount exists.
 * Includes the discount percentage from the hotel.
 */
export async function getActiveDiscount(): Promise<
  CreateSuccess<DiscountWithPercentage | null> | CreateError<string[]>
> {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active session found");
    }

    const { hotelId, userId } = sessionResult.data;

    // Fetch discount with hotel's discount percentage
    const result = await db
      .select({
        discount: hotelDiningDiscounts,
        restaurantDiscount: hotels.restaurantDiscount,
      })
      .from(hotelDiningDiscounts)
      .innerJoin(hotels, eq(hotelDiningDiscounts.hotelId, hotels.id))
      .where(
        and(
          eq(hotelDiningDiscounts.hotelId, hotelId),
          eq(hotelDiningDiscounts.userId, userId),
          eq(hotelDiningDiscounts.status, "requested")
        )
      )
      .limit(1);

    if (result.length === 0) {
      return createSuccess(null);
    }

    return createSuccess({
      ...result[0].discount,
      discountPercent: result[0].restaurantDiscount,
    });
  } catch (error) {
    console.error("Error fetching active discount:", error);
    return createError(
      error instanceof Error ? error.message : "Failed to fetch discount"
    );
  }
}

/**
 * Mark a discount as redeemed after successful payment.
 * This prevents the user from using the discount again.
 */
export async function redeemDiscount(): Promise<
  CreateSuccess<HotelDiningDiscount> | CreateError<string[]>
> {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active session found");
    }

    const { hotelId, userId } = sessionResult.data;

    const updated = await db
      .update(hotelDiningDiscounts)
      .set({ status: "redeemed" })
      .where(
        and(
          eq(hotelDiningDiscounts.hotelId, hotelId),
          eq(hotelDiningDiscounts.userId, userId),
          eq(hotelDiningDiscounts.status, "requested")
        )
      )
      .returning();

    if (updated.length === 0) {
      return createError("No active discount found to redeem");
    }

    return createSuccess(updated[0]);
  } catch (error) {
    console.error("Error redeeming discount:", error);
    return createError(
      error instanceof Error ? error.message : "Failed to redeem discount"
    );
  }
}

