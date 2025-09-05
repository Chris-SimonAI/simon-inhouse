'use server';

import { db } from "@/db";
import { hotels } from "@/db/schemas/hotels";
import { insertHotelSchema, updateHotelSchema } from "@/validations/hotels";
import { z } from "zod";
import { eq } from "drizzle-orm";

// Create a new hotel
export async function createHotel(input: unknown) {
  try {
    const validatedInput = insertHotelSchema.parse(input);
    
    // Convert numbers to strings for decimal database fields
    const dbInput = {
      ...validatedInput,
      latitude: validatedInput.latitude.toString(),
      longitude: validatedInput.longitude.toString(),
    };
    
    const [newHotel] = await db.insert(hotels).values(dbInput).returning();

    return { ok: true, data: newHotel };
  } catch (error) {
    console.error("Error in createHotel:", error);
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to create hotel" };
  }
}


// Get hotel by ID
export async function getHotelById(id: number) {
  try {
    const [hotel] = await db.select().from(hotels).where(eq(hotels.id, id));
    
    if (!hotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    return { ok: true, data: hotel };
  } catch (error) {
    console.error("Error in getHotelById:", error);
    return { ok: false, message: "Failed to fetch hotel" };
  }
}

// Update hotel
export async function updateHotel(id: number, input: unknown) {
  try {
    const validatedInput = updateHotelSchema.parse(input);
    
    // Convert numbers to strings for decimal database fields if they exist
    const dbInput: Record<string, unknown> = { ...validatedInput };
    if (validatedInput.latitude !== undefined) {
      dbInput.latitude = validatedInput.latitude.toString();
    }
    if (validatedInput.longitude !== undefined) {
      dbInput.longitude = validatedInput.longitude.toString();
    }
    
    const [updatedHotel] = await db
      .update(hotels)
      .set(dbInput)
      .where(eq(hotels.id, id))
      .returning();
    
    if (!updatedHotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    return { ok: true, data: updatedHotel };
  } catch (error) {
    console.error("Error in updateHotel:", error);
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Validation failed", errors: error.issues };
    }
    return { ok: false, message: "Failed to update hotel" };
  }
}

// Delete hotel
export async function deleteHotel(id: number) {
  try {
    const [deletedHotel] = await db
      .delete(hotels)
      .where(eq(hotels.id, id))
      .returning();
    
    if (!deletedHotel) {
      return { ok: false, message: "Hotel not found" };
    }
    
    return { ok: true, data: deletedHotel };
  } catch (error) {
    console.error("Error in deleteHotel:", error);
    return { ok: false, message: "Failed to delete hotel" };
  }
}

// Get all hotels
export async function getAllHotels() {
  try {
    const allHotels = await db.select().from(hotels);
    return { ok: true, data: allHotels };
  } catch (error) {
    console.error("Error in getAllHotels:", error);
    return { ok: false, message: "Failed to fetch hotels" };
  }
}