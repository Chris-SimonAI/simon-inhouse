import { NextRequest, NextResponse } from "next/server";
import { applyMenuMarkup } from "@/actions/menu-markup";
import { createError } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (
      !body ||
      typeof body !== "object" ||
      (typeof body.restaurantId !== "number" && typeof body.restaurantId !== "string") ||
      typeof body.markupPercent !== "number"
    ) {
      return NextResponse.json(
        createError("Invalid request body. Expected { restaurantId: number; markupPercent: number }"),
        { status: 400 }
      );
    }

    const restaurantIdNum = Number(body.restaurantId);
    if (Number.isNaN(restaurantIdNum) || restaurantIdNum <= 0) {
      return NextResponse.json(createError("Invalid restaurant ID"), { status: 400 });
    }

    const result = await applyMenuMarkup({
      restaurantId: restaurantIdNum,
      markupPercent: Number(body.markupPercent),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/menus/markup:", error);
    return NextResponse.json(createError("Internal server error"), { status: 500 });
  }
}


