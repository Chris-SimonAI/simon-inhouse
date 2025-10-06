import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";

// POST /api/auth/session/clear - Clear session
export async function POST(request: NextRequest) {
  try {
    //Check if api key is valid
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("Invalid API key"), { status: 401 });
    }

    //Check if api key is valid
    // Get current session
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session) {
      return NextResponse.json(
        createError("No active session found"),
        { status: 401 }
      );
    }

    // Clear the session using Better Auth's signOut
    await auth.api.signOut({
      headers: request.headers,
    });

    return NextResponse.json(createSuccess("Session cleared successfully"));

  } catch (error) {
    console.error("Clear session error:", error);
    return NextResponse.json(createError("Internal server error"),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Same as POST for RESTful consistency
  return POST(request);
}