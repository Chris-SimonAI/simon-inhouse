'use server';

import { dineInRestaurants, hotelRestaurants } from "@/db/schemas";
import type { DineInRestaurant } from "@/db/schemas";
import { db } from "@/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";
import type { CreateError, CreateSuccess } from "@/types/response";
import { getHotelSession } from "@/actions/sessions";


export async function getDineInRestaurantsByHotelId(): Promise<CreateSuccess<DineInRestaurant[]> | CreateError<string[]>> {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active hotel session");
    }
    const hotelId = sessionResult.data.hotelId;

    // Get restaurant IDs linked via the hotel_restaurants junction table
    const linkedRows = await db
      .select({ restaurantId: hotelRestaurants.restaurantId })
      .from(hotelRestaurants)
      .where(
        and(
          eq(hotelRestaurants.hotelId, hotelId),
          eq(hotelRestaurants.isActive, true)
        )
      );
    const linkedIds = linkedRows.map(r => r.restaurantId);

    // Fetch restaurants that are either directly assigned OR linked via junction table
    const restaurantsList = await db
      .select()
      .from(dineInRestaurants)
      .where(
        and(
          eq(dineInRestaurants.status, "approved"),
          linkedIds.length > 0
            ? or(
                eq(dineInRestaurants.hotelId, hotelId),
                inArray(dineInRestaurants.id, linkedIds)
              )
            : eq(dineInRestaurants.hotelId, hotelId)
        )
      );
    return createSuccess(restaurantsList);
  } catch (error) {
    console.error("Error in getDineInRestaurantsByHotelId:", error);
    return createError("Failed to find restaurants by hotel id");
  }
}   

export async function getDineInRestaurantById(id: number): Promise<CreateSuccess<DineInRestaurant> | CreateError<string[]>> {
  try {
    const [restaurant] = await db.select().from(dineInRestaurants).where(eq(dineInRestaurants.id, id));
    return createSuccess(restaurant);
  } catch (error) {
    console.error("Error in getDineInRestaurantById:", error); 
    return createError("Failed to find restaurant by id");
  }
}   

export async function getDineInRestaurantByGuid(guid: string): Promise<CreateSuccess<DineInRestaurant> | CreateError<string[]>> {
  try {
    const [restaurant] = await db.select().from(dineInRestaurants).where(eq(dineInRestaurants.restaurantGuid, guid));
    return createSuccess(restaurant);
  } catch (error) {
    console.error("Error in getDineInRestaurantByGuid:", error); 
    return createError("Failed to find restaurant by guid");
  }
}

/**
 * Restaurant fees response type
 */
export type RestaurantFees = {
  deliveryFee: number;
  serviceFeePercent: number;
  showTips: boolean;
};

/**
 * Get restaurant fees (delivery fee and service fee percent) for display purposes
 * These are used by the UI to show fee line items in checkout
 */
export async function getRestaurantFees(restaurantGuid: string): Promise<CreateSuccess<RestaurantFees> | CreateError<string[]>> {
  try {
    const result = await db
      .select({
        deliveryFee: dineInRestaurants.deliveryFee,
        serviceFeePercent: dineInRestaurants.serviceFeePercent,
        showTips: dineInRestaurants.showTips,
      })
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.restaurantGuid, restaurantGuid))
      .limit(1);

    if (result.length === 0) {
      return createError("Restaurant not found");
    }

    return createSuccess({
      deliveryFee: parseFloat(result[0].deliveryFee),
      serviceFeePercent: parseFloat(result[0].serviceFeePercent),
      showTips: result[0].showTips,
    });
  } catch (error) {
    console.error("Error in getRestaurantFees:", error);
    return createError("Failed to get restaurant fees");
  }
}