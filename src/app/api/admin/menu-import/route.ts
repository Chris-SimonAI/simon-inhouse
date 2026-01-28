import { NextRequest, NextResponse } from "next/server";
import { createError } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";
import { MenuImportSchema } from "@/validations/menu-import";
import { importMenuPayload } from "@/lib/admin/menu-import";

export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = MenuImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createError("Invalid request body", parsed.error.flatten().fieldErrors),
        { status: 400 }
      );
    }

    const result = await importMenuPayload(parsed.data);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/admin/menu-import:", error);
    return NextResponse.json(createError("Internal server error"), { status: 500 });
  }
}
