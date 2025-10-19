'use server';

import { db } from "@/db";
import { amenities, Amenity } from "@/db/schemas/amenities";
import { and, eq, sql } from "drizzle-orm";
import { createSuccess, createError } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";
import { getHotelSession } from "./sessions";



// Get amenity by ID
export async function getAmenityById(id: number): Promise<CreateSuccess<Amenity> | CreateError<string[]>> {  
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("Failed to get hotel session");
    }
    const hotelId = parseInt(sessionResult.data.qrData.hotelId) 

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

export async function getAmenitiesByEmbedding(embedding: number[]): Promise<CreateSuccess<Amenity[]> | CreateError<string[]>> {
  try {
    const hotelSessionResult = await getHotelSession();
    if (!hotelSessionResult.ok || !hotelSessionResult.data) {
      return createError("Failed to get hotel session");
    }
    const hotelId = parseInt(hotelSessionResult.data.qrData.hotelId); 
    console.log("hotelId after getting hotel session", hotelId);
    const embeddingVector = `[${embedding.join(',')}]`;
    const amenitiesList = await db.select().from(amenities).where(and(sql`embedding <-> ${embeddingVector}::vector < 0.1`, eq(amenities.hotelId, hotelId))  );
    return createSuccess(amenitiesList);
  } catch (error) {
    console.error("Error in getAmenitiesByEmbedding:", error);
    return createError("Failed to fetch amenities by embedding");
  }
}
