'use server';

import { db } from "@/db";
import { hotels } from "@/db/schemas/hotels";
import { HotelInsertSchema, HotelUpdateSchema } from "@/validations/hotels";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

// Create a new hotel
export async function createHotel(input: unknown) {
  try {
    const validatedInput = HotelInsertSchema.parse(input);
    
    const [newHotel] = await db.insert(hotels).values(validatedInput).returning();
    
    // Revalidate cache
    revalidateTag('hotels');
    
    return { ok: true, data: newHotel };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to create hotel" };
  }
}


// Get hotel by ID
export async function getHotelById(id: string) {
  try {
    const [hotel] = await db.select().from(hotels).where(eq(hotels.id, id));
    
    if (!hotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    return { ok: true, data: hotel };
  } catch (error) {
    return { ok: false, message: "Failed to fetch hotel" };
  }
}

// Update hotel
export async function updateHotel(id: string, input: unknown) {
  try {
    const validatedInput = HotelUpdateSchema.parse(input);
    
    const [updatedHotel] = await db
      .update(hotels)
      .set(validatedInput)
      .where(eq(hotels.id, id))
      .returning();
    
    if (!updatedHotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    // Revalidate cache
    revalidateTag('hotels');
    
    return { ok: true, data: updatedHotel };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to update hotel" };
  }
}

// Delete hotel
export async function deleteHotel(id: string) {
  try {
    const [deletedHotel] = await db
      .delete(hotels)
      .where(eq(hotels.id, id))
      .returning();
    
    if (!deletedHotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    // Revalidate cache
    revalidateTag('hotels');
    
    return { ok: true, data: deletedHotel };
  } catch (error) {
    return { ok: false, message: "Failed to delete hotel" };
  }
}
