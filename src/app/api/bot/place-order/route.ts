import { NextRequest, NextResponse } from "next/server";
import { placeToastOrder, type OrderRequest } from "@/lib/bot/order-agent";
import { createError, createSuccess } from "@/lib/utils";
import type { BotOrderPayload } from "@/lib/sqs";
import { env } from "@/env";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min timeout for browser automation

export async function POST(request: NextRequest) {
  try {
    const payload: BotOrderPayload = await request.json();

    if (!payload.url || !payload.items || payload.items.length === 0) {
      return NextResponse.json(
        createError("url and items are required"),
        { status: 400 }
      );
    }

    // Convert BotOrderPayload -> OrderRequest
    const guestName = payload.guest?.name || "Guest";
    const nameParts = guestName.split(" ");
    const firstName = nameParts[0] || "Guest";
    const lastName = nameParts.slice(1).join(" ") || "Guest";

    // Parse delivery address from string
    let deliveryAddress: OrderRequest["deliveryAddress"];
    if (payload.deliveryAddress) {
      const parts = payload.deliveryAddress.split(",").map(s => s.trim());
      const street = parts[0] || "";
      const city = parts[1] || "";
      const stateZip = (parts[2] || "").trim().split(/\s+/);
      const state = stateZip[0] || "";
      const zip = stateZip[1] || "";

      deliveryAddress = { street, city, state, zip, apt: payload.apartment };
    }

    const orderRequest: OrderRequest = {
      restaurantUrl: payload.url,
      items: payload.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 1,
        modifiers: item.modifiers,
      })),
      customer: {
        firstName,
        lastName,
        email: payload.guest?.email || "guest@meetsimon.com",
        phone: payload.guest?.phone || "",
      },
      payment: {
        cardNumber: env.BOT_CARD_NUMBER || "",
        expiry: env.BOT_CARD_EXPIRY || "",
        cvv: env.BOT_CARD_CVV || "",
        zip: env.BOT_CARD_ZIP || "",
      },
      orderType: deliveryAddress ? "delivery" : "pickup",
      deliveryAddress,
      dryRun: !env.BOT_CARD_NUMBER,
    };

    console.log(`[place-order] Starting order for orderId=${payload.orderId}, url=${payload.url}`);
    const result = await placeToastOrder(orderRequest);
    console.log(`[place-order] Result for orderId=${payload.orderId}:`, JSON.stringify(result));

    return NextResponse.json(createSuccess(result));
  } catch (error) {
    console.error("Error in POST /api/bot/place-order:", error);
    const message = error instanceof Error ? error.message : "Failed to place order";
    return NextResponse.json(createError(message), { status: 500 });
  }
}
