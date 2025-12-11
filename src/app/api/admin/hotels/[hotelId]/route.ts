import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hotels, type Hotel } from "@/db/schemas/hotels";
import { dineInRestaurants } from "@/db/schemas/dine-in-restaurants";
import { amenities } from "@/db/schemas/amenities";
import { eq } from "drizzle-orm";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";
import { getHotelById, updateHotel } from "@/actions/hotels";
import { updateHotelSchema } from "@/validations/hotels";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    hotelId: string;
  }>;
};

export async function GET(
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

    // Delegate to action for base hotel fetch
    const hotelResult = await getHotelById(hotelIdNum);
    if (!hotelResult.ok) {
      const status = hotelResult.message === "Hotel not found" ? 404 : 500;
      return NextResponse.json(hotelResult, { status });
    }
    const hotel: Hotel = hotelResult.data as Hotel;

    const restaurants = await db
      .select({ id: dineInRestaurants.id })
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.hotelId, hotelIdNum));

    const restaurantIds = restaurants.map((r) => r.id);

    const hotelAmenities = await db
      .select()
      .from(amenities)
      .where(eq(amenities.hotelId, hotelIdNum));

    return NextResponse.json(
      createSuccess({ hotel, restaurantIds, amenities: hotelAmenities })
    );
  } catch (error) {
    console.error("Error in GET /api/admin/hotels/[hotelId]:", error);
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
    const validated = updateHotelSchema.parse(body);

    // If slug is being updated, ensure uniqueness
    if (validated.slug) {
      const existingWithSlug = await db
        .select()
        .from(hotels)
        .where(eq(hotels.slug, validated.slug))
        .limit(1);
      if (existingWithSlug.length > 0 && existingWithSlug[0].id !== hotelIdNum) {
        return NextResponse.json(createError("Hotel slug already exists"), { status: 409 });
      }
    }

    // Delegate update to server action (handles normalization/decimals)
    const result = await updateHotel(hotelIdNum, validated);
    if (!result.ok) {
      const status = result.message === "Hotel not found" ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(createSuccess(result.data));
  } catch (error) {
    console.error("Error in PATCH /api/admin/hotels/[hotelId]:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createError(message), { status: 500 });
  }
}
