import { NextRequest, NextResponse } from "next/server";
import { getEntityData, updateEntityStateAndData, type EntityType } from "@/actions/menu";
import { createError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as EntityType;
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        createError("entityType and entityId query parameters are required"),
        { status: 400 }
      );
    }

    const entityIdNum = parseInt(entityId, 10);
    if (isNaN(entityIdNum)) {
      return NextResponse.json(
        createError("Invalid entity ID"),
        { status: 400 }
      );
    }

    const validEntityTypes: EntityType[] = [
      "restaurant",
      "menu",
      "menu_group",
      "menu_item",
      "modifier_group",
      "modifier_option",
    ];

    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        createError("Invalid entity type"),
        { status: 400 }
      );
    }

    const result = await getEntityData(entityType, entityIdNum);

    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in GET /api/admin/entities:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as EntityType;
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        createError("entityType and entityId query parameters are required"),
        { status: 400 }
      );
    }

    const entityIdNum = parseInt(entityId, 10);
    if (isNaN(entityIdNum)) {
      return NextResponse.json(
        createError("Invalid entity ID"),
        { status: 400 }
      );
    }

    const validEntityTypes: EntityType[] = [
      "restaurant",
      "menu",
      "menu_group",
      "menu_item",
      "modifier_group",
      "modifier_option",
    ];

    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        createError("Invalid entity type"),
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, data } = body;

    // Validate that at least one of status or data is provided
    if (!status && !data) {
      return NextResponse.json(
        createError("Either status or data must be provided"),
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !["pending", "approved", "archived"].includes(status)) {
      return NextResponse.json(
        createError("Invalid status. Must be 'pending', 'approved', or 'archived'"),
        { status: 400 }
      );
    }

    const result = await updateEntityStateAndData(
      entityType,
      entityIdNum,
      status,
      data
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/entities:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}

