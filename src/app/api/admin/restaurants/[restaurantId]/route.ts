import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDataForAdmin, updateRestaurantDataInFormat } from "@/actions/menu";
import { createError } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";

type RouteParams = {
  params: Promise<{
    restaurantId: string;
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

    const { restaurantId } = await params;
    const restaurantIdNum = parseInt(restaurantId, 10);

    if (isNaN(restaurantIdNum)) {
      return NextResponse.json(
        createError("Invalid restaurant ID"),
        { status: 400 }
      );
    }

    const result = await getRestaurantDataForAdmin(restaurantIdNum);

    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in GET /api/admin/restaurants/[restaurantId]:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const { restaurantId } = await params;
    const restaurantIdNum = parseInt(restaurantId, 10);

    if (isNaN(restaurantIdNum)) {
      return NextResponse.json(
        createError("Invalid restaurant ID"),
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate that body has the expected structure
    if (!body || (typeof body !== "object")) {
      return NextResponse.json(
        createError("Invalid request body. Expected object with restaurant and/or menus"),
        { status: 400 }
      );
    }

    const result = await updateRestaurantDataInFormat(restaurantIdNum, body);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/restaurants/[restaurantId]:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}
