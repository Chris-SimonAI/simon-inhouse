'use server';

import { db } from "@/db";
import { amenities, Amenity } from "@/db/schemas/amenities";
import { and, eq } from "drizzle-orm";
import { createSuccess, createError } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";



// Get amenity by ID
export async function getAmenityById(id: number, hotelId: number): Promise<CreateSuccess<Amenity> | CreateError<string[]>> {  
  try {
    const [amenity] = await db.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)));
    
    if (!amenity) {
      return createError("Amenity not found");
    }
    
    return createSuccess(amenity);
  } catch (error) {
    console.error("Error in getAmenityById:", error); 
    return createError("Failed to fetch amenity");
  }
}

// Get amenities by hotel ID
export async function getAmenitiesByHotelId(hotelId: number): Promise<CreateSuccess<Amenity[]> | CreateError<string[]>> {
  try {
    const amenitiesList = await db.select().from(amenities).where(eq(amenities.hotelId, hotelId));

    return createSuccess(amenitiesList);
  } catch (error) {
    console.error("Error in getAmenitiesByHotelId:", error);
    return createError("Failed to fetch amenities by hotel ID");
  }
}