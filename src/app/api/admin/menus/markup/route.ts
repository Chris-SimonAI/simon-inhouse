import { NextRequest, NextResponse } from "next/server";
import { applyMenuMarkup } from "@/lib/menu-markup";
import { createError } from "@/lib/utils";
import { MenuMarkupInput as MenuMarkupInputSchema } from "@/validations/menu-markup";
import { validateApiKey } from "@/utils/api-key-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }
    
    const body = await request.json().catch(() => ({}));

    const parsed = MenuMarkupInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createError("Invalid request body", parsed.error.flatten().fieldErrors),
        { status: 400 }
      );
    }

    const result = await applyMenuMarkup(parsed.data);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/menus/markup:", error);
    return NextResponse.json(createError("Internal server error"), { status: 500 });
  }
}


