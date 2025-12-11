import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { amenities, type NewAmenity } from "@/db/schemas/amenities";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { generateEmbeddingFromJSON } from "@/lib/embedding";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    hotelId: string;
  }>;
};

const AmenityInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  longDescription: z.string().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.unknown().optional(),
  // Accept any numeric array; we will ignore and regenerate server-side
  embedding: z.array(z.number()).optional(),
});

const SetAmenitiesSchema = z.object({
  amenities: z.array(AmenityInputSchema),
});

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const { hotelId } = await params;
    const hotelIdNum = parseInt(hotelId, 10);
    if (isNaN(hotelIdNum) || hotelIdNum <= 0) {
      return NextResponse.json(createError("Invalid hotel ID"), { status: 400 });
    }

    const body = await request.json();
    const parsed = SetAmenitiesSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      if (parsed.amenities.length === 0) {
        return [];
      }

      const upserted: Array<unknown> = [];

      for (const a of parsed.amenities) {
          const newValue: NewAmenity = {
            hotelId: hotelIdNum,
            ...a,
          };
          // Always regenerate embedding from content, ignoring client-provided embedding
          const source = {
            name: a.name,
            description: a.description,
            longDescription: a.longDescription,
            imageUrls: a.imageUrls,
            tags: a.tags,
            metadata: a.metadata,
          } as Record<string, unknown>;
          const embedding = await generateEmbeddingFromJSON(source);
          (newValue as Record<string, unknown>).embedding = embedding;
          const inserted = await tx.insert(amenities).values(newValue).returning();
          if (inserted.length > 0) upserted.push(inserted[0]);
      }

      return upserted;
    });

    return NextResponse.json(createSuccess({ count: result.length, amenities: result }));
  } catch (error) {
    console.error("Error in PUT /api/admin/hotels/[hotelId]/amenities:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createError(message), { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const { hotelId } = await params;
    const hotelIdNum = parseInt(hotelId, 10);
    if (isNaN(hotelIdNum) || hotelIdNum <= 0) {
      return NextResponse.json(createError("Invalid hotel ID"), { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = SetAmenitiesSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      if (parsed.amenities.length === 0) {
        return [];
      }

    const upserted: Array<unknown> = [];
    const notFound: string[] = [];

      for (const a of parsed.amenities) {
        const existing = await tx
          .select({
            id: amenities.id,
            name: amenities.name,
            description: amenities.description,
            longDescription: amenities.longDescription,
            imageUrls: amenities.imageUrls,
            tags: amenities.tags,
            metadata: amenities.metadata,
          })
          .from(amenities)
          .where(and(eq(amenities.hotelId, hotelIdNum), eq(amenities.name, a.name)))
          .limit(1);

        if (existing.length > 0) {
          const updateValues: Record<string, unknown> = {};
          if (a.description !== undefined) updateValues.description = a.description;
          if (a.longDescription !== undefined) updateValues.longDescription = a.longDescription;
          if (a.imageUrls !== undefined) updateValues.imageUrls = a.imageUrls;
          if (a.tags !== undefined) updateValues.tags = a.tags;
          if (a.metadata !== undefined) updateValues.metadata = a.metadata;

          // Always regenerate embedding from merged content, ignoring client-provided embedding
          const current = await tx
            .select({
              name: amenities.name,
              description: amenities.description,
              longDescription: amenities.longDescription,
              imageUrls: amenities.imageUrls,
              tags: amenities.tags,
              metadata: amenities.metadata,
            })
            .from(amenities)
            .where(eq(amenities.id, existing[0].id))
            .limit(1);
          const mergedForEmbedding = {
            name: current[0]?.name,
            description: a.description !== undefined ? a.description : current[0]?.description,
            longDescription: a.longDescription !== undefined ? a.longDescription : current[0]?.longDescription,
            imageUrls: a.imageUrls !== undefined ? a.imageUrls : current[0]?.imageUrls,
            tags: a.tags !== undefined ? a.tags : current[0]?.tags,
            metadata: a.metadata !== undefined ? a.metadata : current[0]?.metadata,
          } as Record<string, unknown>;
          const embedding = await generateEmbeddingFromJSON(mergedForEmbedding);
          updateValues.embedding = embedding;

          if (Object.keys(updateValues).length === 0) {
            const current = await tx
              .select()
              .from(amenities)
              .where(eq(amenities.id, existing[0].id))
              .limit(1);
            if (current.length > 0) upserted.push(current[0]);
            continue;
          }

          const updated = await tx
            .update(amenities)
            .set(updateValues)
            .where(eq(amenities.id, existing[0].id))
            .returning();
          if (updated.length > 0) upserted.push(updated[0]);
      } else {
        // Do not insert on PATCH; report missing amenity by name
        notFound.push(a.name);
        continue;
        }
      }

    return { upserted, notFound };
    });

  // result is an object with upserted and notFound
  // Shape: { updated: Amenity[], count: number, notFound: string[] }
  // Note: avoid leaking secrets; only names in notFound
  const updated = (result as { upserted: unknown[]; notFound: string[] }).upserted;
  const missing = (result as { upserted: unknown[]; notFound: string[] }).notFound;
  return NextResponse.json(
    createSuccess({ count: updated.length, amenities: updated, notFound: missing })
  );
  } catch (error) {
    console.error("Error in PATCH /api/admin/hotels/[hotelId]/amenities:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createError(message), { status: 500 });
  }
}


