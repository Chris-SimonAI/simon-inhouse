import { NextRequest, NextResponse } from "next/server";
import { placeToastOrder, type OrderRequest } from "@/lib/bot/order-agent";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Test endpoint to verify the bot can place an order up to payment failure.
 * Uses a test card that will be declined.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Default test values - can be overridden in request body
  const restaurantUrl = body.url || "https://www.toasttab.com/local/order/uncle-paulies-sunset-1411-west-sunset-boulevard";
  const itemName = body.itemName || "Bacon, Egg & Cheese";

  const orderRequest: OrderRequest = {
    restaurantUrl,
    items: [
      {
        name: itemName,
        quantity: 1,
        modifiers: body.modifiers || [],
      }
    ],
    customer: {
      firstName: "Test",
      lastName: "User",
      email: "test@meetsimon.com",
      phone: "3105551234",
    },
    payment: {
      cardNumber: "4000000000000002", // Test card that will be declined
      expiry: "12/28",
      cvv: "123",
      zip: "90210",
    },
    orderType: "pickup",
    dryRun: true, // This tells the agent we expect the card to be declined
  };

  console.log(`[test-order] Starting test order at ${restaurantUrl}`);
  console.log(`[test-order] Item: ${itemName}`);

  try {
    const result = await placeToastOrder(orderRequest);
    console.log(`[test-order] Result:`, JSON.stringify(result, null, 2));

    return NextResponse.json({
      ok: result.success,
      message: result.message,
      stage: result.stage,
      details: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[test-order] Error:`, message);
    return NextResponse.json({
      ok: false,
      message,
    }, { status: 500 });
  }
}

// GET endpoint to show usage
export async function GET() {
  return NextResponse.json({
    usage: "POST with optional body: { url, itemName, modifiers[] }",
    defaults: {
      url: "https://www.toasttab.com/local/order/uncle-paulies-sunset-1411-west-sunset-boulevard",
      itemName: "Bacon, Egg & Cheese",
    },
    description: "Tests the bot order flow up to payment decline with test card 4000000000000002",
  });
}
