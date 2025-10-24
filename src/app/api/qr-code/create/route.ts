import { createQRCode } from "@/actions/qr-code";
import { createError, createSuccess } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/utils/api-key-validation";

export async function POST(request: NextRequest) {
  try {
    //Check if api key is valid
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("Invalid API key"), { status: 401 });
    }

    const body = await request.json();
    const { hotelId } = body;

    const qrCode = await createQRCode(hotelId);
    if (!qrCode.ok) {
      return NextResponse.json(createError(qrCode.message || "Failed to create QR code"), { status: 500 });
    }
    return NextResponse.json(createSuccess(qrCode, "QR code created successfully"));
  } catch (error) {
    console.error("Error creating QR code:", error);
    return NextResponse.json(createError("Failed to create QR code"), { status: 500 });
  }
}