'use server';

import { db } from "@/db";
import { amenities } from "@/db/schemas/amenities";
import { AmenitiesInsertSchema, AmenitiesUpdateSchema } from "@/validations/amenities";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

// Create a new amenities
export async function createAmenities(input: unknown, revalidate = true) {
    try {
      const validatedInput = AmenitiesInsertSchema.parse(input);
      
      const [newAmenities] = await db.insert(amenities).values(validatedInput).returning();
      
      // Revalidate cache
      if(revalidate) {
        revalidateTag('amenities');
      }
      
      return { ok: true, data: newAmenities };
    } catch (error) {
      console.error("Error in createAmenities:", error);
      if (error instanceof z.ZodError) {
        return { ok: false, message: "Validation failed", errors: error.issues };
      }
      return { ok: false, message: "Failed to create amenities" };
    }
  }
  
  
  // Get amenties by ID
  export async function getAmenitiesByID(id: string) {
    try {
      const [amenity] = await db.select().from(amenities).where(eq(amenities.id, id));
      
      if (!amenity) {
        return { ok: false, message: "Amenity not found" };
      }
      
      return { ok: true, data: amenity };
    } catch (error) {
      console.error("Error in getAmentiesByID:", error);
      return { ok: false, message: "Failed to fetch amenities" };
    }
  }

  // Get amenities by hotel ID
  export async function getAmenitiesByHotelID(hotelId: string) {
    try {
      const amenity = await db.select().from(amenities).where(eq(amenities.hotelId, hotelId));

      if (!amenity) {
        return { ok: false, message: "Amenity not found" };
      }

      return { ok: true, data: amenity };
    } catch (error) {
      console.error("Error in getAmenitiesByHotelID:", error);
      return { ok: false, message: "Failed to fetch amenities by hotel ID" };
    }
  }
  
  // Update amenities
  export async function updateAmenities(id: string, input: unknown) {
    try {
      const validatedInput = AmenitiesUpdateSchema.parse(input);
      
      const [updatedAmenity] = await db
        .update(amenities)
        .set(validatedInput)
        .where(eq(amenities.id, id))
        .returning();
      
      if (!updatedAmenity) {
        return { ok: false, message: "Amenity not found" };
      }
      
      // Revalidate cache
      revalidateTag('amenities');
      
      return { ok: true, data: updatedAmenity };
    } catch (error) {
      console.error("Error in updateAmenities:", error);
      if (error instanceof z.ZodError) {
        return { ok: false, message: "Validation failed", errors: error.issues };
      }
      return { ok: false, message: "Failed to update amenities" };
    }
  }
  
  // Delete amenties
  export async function deleteAmenities(id: string) {
    try {
      const [deletedAmenities] = await db
        .delete(amenities)
        .where(eq(amenities.id, id))
        .returning();
      
      if (!deletedAmenities) {
        return { ok: false, message: "Amenity not found" };
      }
      
      // Revalidate cache
      revalidateTag('amenities');
      
      return { ok: true, data: deletedAmenities };
    } catch (error) {
      console.error("Error in deleteAmenities:", error);
      return { ok: false, message: "Failed to delete amenities" };
    }
  }