import { NextRequest, NextResponse } from "next/server";
import { revokeQRCodeByCodeAndSessions } from "@/actions/qrCode";
import { z } from "zod";
import { QRRevokeSchema } from "@/validations/qrCodes";
import { createError, createSuccess } from "@/lib/utils";
import { validateApiKey } from "@/utils/api-key-validation";

// POST /api/qr-revoke
export async function POST(request: NextRequest) {
  try {
    //Check if api key is valid
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("Invalid API key"), { status: 401 });
    }

    const body = await request.json();
    const { qrCode } = QRRevokeSchema.parse(body);

    if (!qrCode) {
      return NextResponse.json(createError("QR code is required"), { status: 400 });
    }
    // Revoke QR code by code and delete all associated sessions
    const result = await revokeQRCodeByCodeAndSessions(qrCode);
    
    if (!result?.ok) {
      return NextResponse.json(
        createError(result?.message || "Failed to revoke QR code"),
        { status: 400 }
      );
    }

    return NextResponse.json(createSuccess(result.data, "QR code revoked successfully"));

  } catch (error) {
    console.error("QR revoke error:", error);

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

// DELETE /api/qr-revoke
export async function DELETE(request: NextRequest) {
  // Same as POST for RESTful consistency
  return POST(request);
}