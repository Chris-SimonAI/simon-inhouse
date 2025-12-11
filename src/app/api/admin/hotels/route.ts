import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hotels } from "@/db/schemas/hotels";
import { insertHotelSchema, type InsertHotel } from "@/validations/hotels";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";
import { eq } from "drizzle-orm";
import { createHotel } from "@/actions/hotels";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Validate input using zod derived from drizzle schema
    const input = insertHotelSchema.parse(body) as InsertHotel;

    // Optional: ensure slug uniqueness at app level (DB may also enforce)
    const existing = await db.select().from(hotels).where(eq(hotels.slug, input.slug)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json(createError("Hotel slug already exists"), { status: 409 });
    }

    const result = await createHotel(input);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(createSuccess(result.data), { status: 201 });
  } catch (error) {
    console.error("Error in PUT /api/admin/hotels:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createError(message), { status: 500 });
  }
}


