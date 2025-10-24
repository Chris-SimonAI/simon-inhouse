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
    const hotelSessionResult = await getHotelSession();
    if (!hotelSessionResult.ok || !hotelSessionResult.data) {
      return createError("Failed to get hotel session");
    }

    const hotelId = parseInt(hotelSessionResult.data.qrData.hotelId);
    if (isNaN(hotelId)) {
      return createError("Invalid hotel ID");
    }

    const embeddingVector = `[${embedding.join(",")}]`;
    const topK = 5; 
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

    if (semanticResults.length === 0) {
      return createSuccess([]);
    }

    semanticResults.sort((a, b) => a.distance - b.distance);
    const best = semanticResults[0].distance;
    const gapThreshold = 0.25; 
    const filteredByDistance = semanticResults.filter(
      (r) => r.distance <= best + gapThreshold
    );

    const normalize = (x: number, min: number, max: number) =>
      max === min ? 1 : (max - x) / (max - min);
    const minDist = Math.min(...filteredByDistance.map((r) => r.distance));
    const maxDist = Math.max(...filteredByDistance.map((r) => r.distance));

    const queryLower = query?.toLowerCase() ?? "";

    const weighted = filteredByDistance.map((r) => {
      const semanticScore = normalize(r.distance, minDist, maxDist);
      const keywordScore = queryLower
        ? Number(
            r.name.toLowerCase().includes(queryLower) ||
            r.description?.toLowerCase().includes(queryLower) ||
            r.tags?.toString().toLowerCase().includes(queryLower)
          )
        : 0;
      const finalScore = 0.8 * semanticScore + 0.2 * keywordScore;
      return { ...r, finalScore };
    });

    weighted.sort((a, b) => b.finalScore - a.finalScore);

    const topScore = weighted[0].finalScore;
    const scoreCutoff = topScore - 0.3;
    const finalResults = weighted.filter((r) => r.finalScore >= scoreCutoff);

    if (finalResults.length > 0) {
      return createSuccess(finalResults as unknown as Amenity[]);
    }

    if (!queryLower) {
      return createSuccess([]);
    }

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

    return createSuccess(keywordMatches);
  } catch (error) {
    console.error("Error in getAmenitiesByEmbedding:", error);
    return createError("Failed to fetch amenities by embedding");
  }
}
