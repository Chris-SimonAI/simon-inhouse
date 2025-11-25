'use server';

import { DineInRestaurant, dineInRestaurants } from "@/db/schemas"; 
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";
import { getHotelSession } from "@/actions/sessions";


export async function getDineInRestaurantsByHotelId(): Promise<CreateSuccess<DineInRestaurant[]> | CreateError<string[]>> {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active hotel session");
    }
    const hotelId = sessionResult.data.hotelId;
    const restaurantsList = await db
      .select()
      .from(dineInRestaurants)
      .where(
        and(
          eq(dineInRestaurants.hotelId, hotelId),
          eq(dineInRestaurants.status, "approved")
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