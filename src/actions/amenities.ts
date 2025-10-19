'use server';

import { db } from "@/db";
import { amenities, Amenity } from "@/db/schemas/amenities";
import { and, eq, sql, asc } from "drizzle-orm";
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

export async function getAmenitiesByEmbedding(
  embedding: number[],
  query?: string
): Promise<CreateSuccess<Amenity[]> | CreateError<string[]>> {
  try {
    // ✅ Step 1: Get current hotel session
    const hotelSessionResult = await getHotelSession();
    if (!hotelSessionResult.ok || !hotelSessionResult.data) {
      return createError("Failed to get hotel session");
    }

    const hotelId = parseInt(hotelSessionResult.data.qrData.hotelId);
    console.log("hotelId after getting hotel session", hotelId);

    // ✅ Step 2: Prepare embedding vector literal
    const embeddingVector = `[${embedding.join(",")}]`;
    const topK = 5;

    console.log("Searching with normalized embedding vector length:", embedding.length);

    // ✅ Step 3: Semantic (vector) search
    const semanticResults = await db
      .select({
        id: amenities.id,
        name: amenities.name,
        description: amenities.description,
        longDescription: amenities.longDescription,
        tags: amenities.tags,
        imageUrls: amenities.imageUrls,
        distance: sql`embedding <-> ${embeddingVector}::vector`.as<number>(),
      })
      .from(amenities)
      .where(eq(amenities.hotelId, hotelId))
      .orderBy(asc(sql`embedding <-> ${embeddingVector}::vector`))
      .limit(topK);

    console.log(`Found ${semanticResults.length} amenities with semantic search`);

    for (const row of semanticResults) {
      console.log(`Amenity: ${row.name}, Distance: ${row.distance.toFixed(3)}`);
    }

    // ✅ Step 4: Apply a reasonable distance threshold (optional)
    const maxDistance = 1.2; // tuned for cosine distance
    const filtered = semanticResults.filter((r) => r.distance < maxDistance);

    if (filtered.length > 0) {
      console.log(`${filtered.length} amenities passed distance threshold (${maxDistance})`);
      return createSuccess(filtered as unknown as Amenity[]);
    }

    // ✅ Step 5: Keyword fallback
    console.log("No good semantic matches found, trying keyword fallback");

    if (!query) {
      console.log("No query provided for keyword fallback");
      return createSuccess([]);
    }

    const queryLower = query.toLowerCase();

    const keywordMatches = await db
      .select()
      .from(amenities)
      .where(
        and(
          eq(amenities.hotelId, hotelId),
          sql`LOWER(name) LIKE ${`%${queryLower}%`} 
            OR LOWER(description) LIKE ${`%${queryLower}%`} 
            OR LOWER(tags::text) LIKE ${`%${queryLower}%`}`
        )
      );

    console.log(
      `Keyword fallback found ${keywordMatches.length} amenities:`,
      keywordMatches.map((a) => a.name)
    );

    return createSuccess(keywordMatches);
  } catch (error) {
    console.error("Error in getAmenitiesByEmbedding:", error);
    return createError("Failed to fetch amenities by embedding");
  }
}
