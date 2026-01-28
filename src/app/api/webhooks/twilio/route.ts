import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import "server-only";

export const runtime = "nodejs";

import { db } from "@/db";
import { dineInOrders } from "@/db/schemas";
import { eq, inArray, desc } from "drizzle-orm";
import { parseToastSMS } from "@/lib/sms-parser";
import { sendStatusUpdateSMS } from "@/lib/notifications";
import { sendSMS } from "@/lib/twilio";
import { getOrCreateGuestProfile, getOrCreateSmsThreadId } from "@/actions/guest-profiles";
import { invokeSmsAgent } from "@/lib/agent/sms-instance";

// Empty TwiML response — we send our reply via REST API, not TwiML,
// because the agent may take 20-30 seconds (beyond Twilio's 15s timeout).
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

function twimlResponse() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Twilio incoming SMS webhook.
 * Handles two types of messages:
 * 1. Toast order status updates → parse, match order, forward to guest
 * 2. Guest messages → route to SMS ordering agent
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const body = (formData.get("Body") as string) || "";
    const from = (formData.get("From") as string) || "";
    const to = (formData.get("To") as string) || "";
    const messageSid = (formData.get("MessageSid") as string) || "";

    console.log(`[twilio-webhook] Incoming SMS from=${from} to=${to} sid=${messageSid}`);
    console.log(`[twilio-webhook] Body: ${body.substring(0, 100)}`);

    if (!from || !body) {
      console.warn("[twilio-webhook] Missing From or Body");
      return twimlResponse();
    }

    // Parse the SMS for order status keywords
    const parsed = parseToastSMS(body);
    console.log(`[twilio-webhook] Parsed: status=${parsed.status}, isOrderUpdate=${parsed.isOrderUpdate}`);

    if (parsed.isOrderUpdate) {
      // This is a Toast order status update — handle and forward to guest
      await handleToastStatusUpdate(body, parsed);
      return twimlResponse();
    }

    // This is a guest message — route to SMS agent (async, return 200 immediately)
    handleGuestMessage(from, body).catch((err) => {
      console.error("[twilio-webhook] Error handling guest message:", err);
    });

    return twimlResponse();
  } catch (error) {
    console.error("[twilio-webhook] Error:", error);
    return twimlResponse();
  }
}

/**
 * Handle Toast order status update SMS.
 * Match to an order and forward status to the guest.
 */
async function handleToastStatusUpdate(
  body: string,
  parsed: ReturnType<typeof parseToastSMS>
): Promise<void> {
  console.log(`[twilio-webhook] Toast status update: ${parsed.status}`);

  // Find matching order by looking at recent active orders
  const activeOrders = await db
    .select()
    .from(dineInOrders)
    .where(
      inArray(dineInOrders.orderStatus, [
        "requested_to_toast",
        "toast_ordered",
        "confirmed",
      ])
    )
    .orderBy(desc(dineInOrders.createdAt))
    .limit(20);

  // Try to match by confirmation number in metadata if we have one
  let order = activeOrders[0] || null; // Default to most recent

  if (!order) {
    console.log("[twilio-webhook] No matching order found");
    return;
  }

  console.log(`[twilio-webhook] Matched order ${order.id}`);

  // Get guest phone from order metadata
  const meta = (order.metadata as Record<string, unknown>) || {};
  const guestPhone = (meta.phoneNumber as string) || "";

  // Update order metadata with latest Toast status
  await db
    .update(dineInOrders)
    .set({
      metadata: {
        ...meta,
        lastToastStatus: parsed.status,
        lastToastSmsBody: body,
        lastToastSmsAt: new Date().toISOString(),
      } as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(dineInOrders.id, order.id));

  // Forward status update to guest
  if (guestPhone && parsed.status) {
    await sendStatusUpdateSMS({
      guestPhone,
      status: parsed.status,
    });
    console.log(`[twilio-webhook] Forwarded status "${parsed.status}" to guest ${guestPhone}`);
  }
}

/**
 * Handle a guest SMS message asynchronously.
 * Runs after we've already returned 200 to Twilio.
 */
async function handleGuestMessage(from: string, body: string): Promise<void> {
  console.log("[twilio-webhook] Processing guest message:", {
    from,
    body: body.substring(0, 100),
  });

  // 1. Get or create guest profile
  const profile = await getOrCreateGuestProfile(from);

  // 2. Get or create persistent thread ID
  const threadId = await getOrCreateSmsThreadId(from);

  // 3. Determine hotelId (from profile, or use default)
  const hotelId = profile.hotelId;
  if (!hotelId) {
    console.warn("[twilio-webhook] Guest has no hotelId, cannot route to agent:", from);
    await sendSMS(
      from,
      "Hi! I'm Simon, your hotel food ordering assistant. It looks like I don't have your hotel on file yet. Please place your first order through the hotel's ordering page, and I'll remember you for next time!"
    );
    return;
  }

  // 4. Invoke the SMS agent
  console.log("[twilio-webhook] Invoking SMS agent:", { from, threadId, hotelId });
  const response = await invokeSmsAgent({
    message: body,
    threadId,
    hotelId,
    guestPhone: from,
  });

  // 5. Send the response via REST API (not TwiML)
  console.log("[twilio-webhook] Agent response:", response.substring(0, 200));

  // Twilio SMS limit is 1600 chars. Split if needed.
  if (response.length <= 1600) {
    await sendSMS(from, response);
  } else {
    const chunks = splitMessage(response, 1600);
    for (const chunk of chunks) {
      await sendSMS(from, chunk);
    }
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf(". ", maxLength);
    if (splitAt === -1 || splitAt < maxLength / 2) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt === -1) {
      splitAt = maxLength;
    } else {
      splitAt += 1;
    }
    chunks.push(remaining.substring(0, splitAt).trim());
    remaining = remaining.substring(splitAt).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
