'use server';

import { db } from "@/db";
import { amenities } from "@/db/schemas/amenities";
import { insertAmenitySchema, updateAmenitySchema } from "@/validations/amenities";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

// Create a new amenity
export async function createAmenity(input: unknown) {
  try {
    const validatedInput = insertAmenitySchema.parse(input);  
    
    const [newAmenity] = await db.insert(amenities).values(validatedInput).returning();   
    
    return { ok: true, data: newAmenity };
  } catch (error) {
    console.error("Error in createAmenity:", error);  
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to create amenity" };
  }
}


export async function createManyAmenities(input: unknown) {
  try {
    const insertManyAmenitiesSchema = z.array(insertAmenitySchema);
    const validatedInput = insertManyAmenitiesSchema.parse(input);   
    
    const newAmenities = await db.insert(amenities).values(validatedInput).returning();
    
    return { ok: true, data: newAmenities };
  } catch (error) {
    console.error("Error in createManyAmenities:", error);
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to create amenities" };
  }
}

// Get amenity by ID
export async function getAmenityById(id: number, hotelId: number) {  
  try {
    const [amenity] = await db.select().from(amenities).where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)));
    
    if (!amenity) {
      return { ok: false, message: "Amenity not found" };
    }
    
    return { ok: true, data: amenity };
  } catch (error) {
    console.error("Error in getAmenityById:", error); 
    return { ok: false, message: "Failed to fetch amenity" };
  }
}

// Get amenities by hotel ID
export async function getAmenitiesByHotelId(hotelId: number) {
  try {
    const amenitiesList = await db.select().from(amenities).where(eq(amenities.hotelId, hotelId));

    return { ok: true, data: amenitiesList };
  } catch (error) {
    console.error("Error in getAmenitiesByHotelId:", error);
    return { ok: false, message: "Failed to fetch amenities by hotel ID" };
  }
}
  
// Update amenity
export async function updateAmenity(id: number, input: unknown, hotelId: number) {
  try {
    const validatedInput = updateAmenitySchema.parse(input);    
    
    const [updatedAmenity] = await db
      .update(amenities)
      .set(validatedInput)
      .where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)))
      .returning();
    
    if (!updatedAmenity) {
      return { ok: false, message: "Amenity not found" };
    }
    
    return { ok: true, data: updatedAmenity };
  } catch (error) {
    console.error("Error in updateAmenity:", error);
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to update amenity" };
  }
}
  
// Delete amenity
export async function deleteAmenity(id: number, hotelId: number) {
  try {
    const [deletedAmenity] = await db
      .delete(amenities)
      .where(and(eq(amenities.id, id), eq(amenities.hotelId, hotelId)))
      .returning();
    
    if (!deletedAmenity) {
      return { ok: false, message: "Amenity not found" };
    }
    
    return { ok: true, data: deletedAmenity };
  } catch (error) {
    console.error("Error in deleteAmenity:", error);  
    return { ok: false, message: "Failed to delete amenity" };
  }
}