import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";

// GET /api/auth/session/status - Check current session status
export async function GET(request: NextRequest) {
  try {
    //Check if api key is valid
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("Invalid API key"), { status: 401 });
    }

    // Get Better Auth session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        createError("No active session found"),
        { status: 401 }
      );
    }

    if (!session.session.hotelId || !session.session.threadId) {
      return NextResponse.json(
        createError("Session not initialised for a hotel"),
        { status: 401 }
      );
    }

    return NextResponse.json(createSuccess({
      sessionId: session.session.id,
      userId: session.session.userId,
      hotelId: session.session.hotelId,
      threadId: session.session.threadId,
      sessionActive: true,
    }));

  } catch (error) {
    console.error("Get session status error:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}
