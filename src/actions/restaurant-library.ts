'use server';

import { db } from "@/db";
import { dineInRestaurants, hotels, hotelRestaurants } from "@/db/schemas";
import { eq, ne, and } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";

/**
 * Get all restaurants in the library with their linked hotels
 */
export async function getRestaurantLibrary() {
  try {
    const restaurants = await db
      .select({
        id: dineInRestaurants.id,
        name: dineInRestaurants.name,
        description: dineInRestaurants.description,
        cuisine: dineInRestaurants.cuisine,
        imageUrls: dineInRestaurants.imageUrls,
        status: dineInRestaurants.status,
        addressLine1: dineInRestaurants.addressLine1,
        city: dineInRestaurants.city,
        state: dineInRestaurants.state,
        latitude: dineInRestaurants.latitude,
        longitude: dineInRestaurants.longitude,
        hotelId: dineInRestaurants.hotelId,
        metadata: dineInRestaurants.metadata,
        createdAt: dineInRestaurants.createdAt,
      })
      .from(dineInRestaurants)
      .orderBy(dineInRestaurants.name);

    // Get hotel links for each restaurant
    const _restaurantIds = restaurants.map(r => r.id);

    // Get original hotel names
    const hotelNames = await db
      .select({
        restaurantId: dineInRestaurants.id,
        hotelName: hotels.name,
        hotelId: hotels.id,
      })
      .from(dineInRestaurants)
      .innerJoin(hotels, eq(dineInRestaurants.hotelId, hotels.id));

    // Get additional hotel links from junction table
    const additionalLinks = await db
      .select({
        restaurantId: hotelRestaurants.restaurantId,
        hotelId: hotelRestaurants.hotelId,
        hotelName: hotels.name,
        distanceMiles: hotelRestaurants.distanceMiles,
        isActive: hotelRestaurants.isActive,
      })
      .from(hotelRestaurants)
      .innerJoin(hotels, eq(hotelRestaurants.hotelId, hotels.id));

    // Combine the data
    const restaurantsWithHotels = restaurants.map(restaurant => {
      const originalHotel = hotelNames.find(h => h.restaurantId === restaurant.id);
      const linkedHotels = additionalLinks
        .filter(l => l.restaurantId === restaurant.id)
        .map(l => ({
          hotelId: l.hotelId,
          hotelName: l.hotelName,
          distanceMiles: l.distanceMiles,
          isActive: l.isActive,
        }));

      return {
        ...restaurant,
        originalHotel: originalHotel ? {
          hotelId: originalHotel.hotelId,
          hotelName: originalHotel.hotelName,
        } : null,
        linkedHotels,
      };
    });

    return createSuccess(restaurantsWithHotels);
  } catch (error) {
    console.error("Error in getRestaurantLibrary:", error);
    return createError("Failed to fetch restaurant library");
  }
}

/**
 * Get all hotels for the dropdown
 */
export async function getAllHotelsForLinking() {
  try {
    const allHotels = await db
      .select({
        id: hotels.id,
        name: hotels.name,
        latitude: hotels.latitude,
        longitude: hotels.longitude,
      })
      .from(hotels)
      .orderBy(hotels.name);

    return createSuccess(allHotels);
  } catch (error) {
    console.error("Error in getAllHotelsForLinking:", error);
    return createError("Failed to fetch hotels");
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Link a restaurant to a hotel
 */
export async function linkRestaurantToHotel(restaurantId: number, hotelId: number, maxDistanceMiles: number = 10) {
  try {
    // Get restaurant and hotel details
    const [restaurant] = await db
      .select()
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, restaurantId));

    const [hotel] = await db
      .select()
      .from(hotels)
      .where(eq(hotels.id, hotelId));

    if (!restaurant) {
      return createError("Restaurant not found");
    }
    if (!hotel) {
      return createError("Hotel not found");
    }

    // Check if already linked (either as original or via junction)
    if (restaurant.hotelId === hotelId) {
      return createError("Restaurant is already the original for this hotel");
    }

    const [existingLink] = await db
      .select()
      .from(hotelRestaurants)
      .where(and(
        eq(hotelRestaurants.restaurantId, restaurantId),
        eq(hotelRestaurants.hotelId, hotelId)
      ));

    if (existingLink) {
      return createError("Restaurant is already linked to this hotel");
    }

    // Calculate distance if coordinates available
    let distanceMiles: number | null = null;
    if (restaurant.latitude && restaurant.longitude && hotel.latitude && hotel.longitude) {
      distanceMiles = calculateDistance(
        parseFloat(restaurant.latitude),
        parseFloat(restaurant.longitude),
        parseFloat(hotel.latitude),
        parseFloat(hotel.longitude)
      );

      if (distanceMiles > maxDistanceMiles) {
        return createError(`Restaurant is ${distanceMiles.toFixed(1)} miles away, exceeds ${maxDistanceMiles} mile limit`);
      }
    }

    // Create the link
    const [link] = await db
      .insert(hotelRestaurants)
      .values({
        hotelId,
        restaurantId,
        distanceMiles: distanceMiles?.toFixed(2),
        isActive: true,
      })
      .returning();

    return createSuccess(link);
  } catch (error) {
    console.error("Error in linkRestaurantToHotel:", error);
    return createError("Failed to link restaurant to hotel");
  }
}

/**
 * Unlink a restaurant from a hotel
 */
export async function unlinkRestaurantFromHotel(restaurantId: number, hotelId: number) {
  try {
    const [deleted] = await db
      .delete(hotelRestaurants)
      .where(and(
        eq(hotelRestaurants.restaurantId, restaurantId),
        eq(hotelRestaurants.hotelId, hotelId)
      ))
      .returning();

    if (!deleted) {
      return createError("Link not found");
    }

    return createSuccess(deleted);
  } catch (error) {
    console.error("Error in unlinkRestaurantFromHotel:", error);
    return createError("Failed to unlink restaurant");
  }
}

/**
 * Get restaurants available for a hotel (within distance)
 */
export async function getAvailableRestaurantsForHotel(hotelId: number, maxDistanceMiles: number = 10) {
  try {
    const [hotel] = await db
      .select()
      .from(hotels)
      .where(eq(hotels.id, hotelId));

    if (!hotel) {
      return createError("Hotel not found");
    }

    // Get all restaurants not already linked to this hotel
    const allRestaurants = await db
      .select()
      .from(dineInRestaurants)
      .where(ne(dineInRestaurants.hotelId, hotelId));

    // Filter by distance if hotel has coordinates
    const availableRestaurants = allRestaurants
      .map(restaurant => {
        let distance: number | null = null;
        if (restaurant.latitude && restaurant.longitude && hotel.latitude && hotel.longitude) {
          distance = calculateDistance(
            parseFloat(restaurant.latitude),
            parseFloat(restaurant.longitude),
            parseFloat(hotel.latitude),
            parseFloat(hotel.longitude)
          );
        }
        return { ...restaurant, distance };
      })
      .filter(r => r.distance === null || r.distance <= maxDistanceMiles)
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    return createSuccess(availableRestaurants);
  } catch (error) {
    console.error("Error in getAvailableRestaurantsForHotel:", error);
    return createError("Failed to fetch available restaurants");
  }
}
