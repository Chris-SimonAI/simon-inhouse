import { NextRequest, NextResponse } from "next/server";
import { bulkUpdateEntities, type EntityType } from "@/lib/admin/menu";
import { createError } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";

type RouteParams = {
  params: Promise<{
    restaurantId: string;
  }>;
};

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
    const { operations } = body;

    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        createError("operations array is required and must not be empty"),
        { status: 400 }
      );
    }

    // Validate each operation
    const validEntityTypes: EntityType[] = [
      "menu",
      "menu_group",
      "menu_item",
      "modifier_group",
      "modifier_option",
    ];

    for (const operation of operations) {
      if (!operation.entityType || !operation.entityId) {
        return NextResponse.json(
          createError("Each operation must have entityType and entityId"),
          { status: 400 }
        );
      }

      if (!validEntityTypes.includes(operation.entityType)) {
        return NextResponse.json(
          createError(`Invalid entity type: ${operation.entityType}`),
          { status: 400 }
        );
      }

      if (typeof operation.entityId !== "number") {
        return NextResponse.json(
          createError("entityId must be a number"),
          { status: 400 }
        );
      }

      if (operation.status && !["pending", "approved", "archived"].includes(operation.status)) {
        return NextResponse.json(
          createError(`Invalid status: ${operation.status}`),
          { status: 400 }
        );
      }
    }

    const result = await bulkUpdateEntities(restaurantIdNum, operations);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/restaurants/[restaurantId]/bulk-state:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}

