import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateUUID } from "@/utils/uuid";
import {
  createSession,
} from "@/lib/sessions";
import { validateQRCode } from "@/actions/qrCode";
import { auth } from "@/lib/auth";
import { createError, createSuccess } from "@/lib/utils";
import { updateSession } from "@/actions/sessions";

interface BetterAuthSession {
  session: {
    id: string;
    userId: string;
    token?: string;
    hotelId?: string;
    qrId?: string;
    threadId?: string;
    qrCode?: string;
  };
}


/**
 * Processes QR code - validates and creates/updates session
 */
async function processQRCode(qrCode: string, existingSession: BetterAuthSession | null, request: NextRequest): Promise<NextResponse> {
  // Validate QR code
  const qrResult = await validateQRCode(qrCode);
  if (!qrResult?.ok || !qrResult?.data) {
    return NextResponse.json(
      createError("Invalid or expired QR code"),
      { status: 400 }
    );
  }

  // Generate threadId and prepare QR data
  const threadId = generateUUID();
  const qrData = {
    hotelId: qrResult.data.hotelId.toString(),
    qrId: qrResult.data.id.toString(),
    qrCode: qrResult.data.code,
    threadId: threadId,
  };

  if (!existingSession) {
    // Create new session
    const userId = generateUUID();
    const newSessionResponse = await createSession({
      userId,
      hotelId: qrData.hotelId,
      qrId: qrData.qrId,
      threadId,
      qrCode: qrData.qrCode,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    if (!newSessionResponse) {
      return NextResponse.json(
        createError("Failed to create session"),
        { status: 500 }
      );
    }

    if (newSessionResponse instanceof Response) {
      return newSessionResponse as unknown as NextResponse;
    }

    return NextResponse.json(createSuccess(newSessionResponse));
  } else {
    // Check if it's the same QR code - no need to update
    if (existingSession.session.qrCode === qrData.qrCode) {
      const existingSessionResponse = {
        sessionId: existingSession.session.id,
        userId: existingSession.session.userId,
        qrData: {
          hotelId: existingSession.session.hotelId,
          qrId: existingSession.session.qrId,
          threadId: existingSession.session.threadId,
          qrCode: existingSession.session.qrCode,
        },
      };
      
      return NextResponse.json(createSuccess(existingSessionResponse));
    }

    // Update existing session with new QR data
    const updatedSession = await updateSession({
      hotelId: qrData.hotelId,
      qrId: qrData.qrId,
      threadId: qrData.threadId,
      qrCode: qrData.qrCode,
      token: existingSession.session.token,
    });

    if (!updatedSession.ok || !updatedSession.data) {
      return NextResponse.json(
        createError("Failed to update session"),
        { status: 500 }
      );
    }

    const updatedSessionResponse = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true }
    });
    
    return NextResponse.json(createSuccess(updatedSessionResponse));
  }
}

// POST /api/auth/qr-scan - Scan QR code
export async function POST(request: NextRequest) {
  try {
    const qrCode = request.nextUrl.searchParams.get('qrCode');
    const existingSession = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true }
    });

    // Validate request parameters
    if (!existingSession && !qrCode) {
      return NextResponse.json(
        createError("No active session found and no QR code provided"), 
        { status: 401 }
      );
    }

    if (!qrCode) {
      return NextResponse.json(
        createError("QR code is required"),
        { status: 400 }
      );
    }

    // Process QR code (creates new session or updates existing one)
    return await processQRCode(qrCode, existingSession, request);

  } catch (error) {
    console.error("QR scan error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createError("Invalid request data", error.issues),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createError(error instanceof Error ? error.message : "Internal server error"),
      { status: 500 }
    );
  }
}
