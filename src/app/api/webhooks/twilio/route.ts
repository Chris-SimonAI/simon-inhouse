import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dineInOrders } from '@/db/schemas';
import { eq, inArray, desc } from 'drizzle-orm';
import { parseToastSMS } from '@/lib/sms-parser';
import { sendStatusUpdateSMS } from '@/lib/notifications';

export const runtime = 'nodejs';

// Always return 200 with empty TwiML to prevent Twilio retries
const EMPTY_TWIML = '<Response/>';
function twimlResponse() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Twilio incoming SMS webhook.
 * Toast sends order updates to our Twilio number → we parse and forward to guest.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const body = formData.get('Body') as string || '';
    const from = formData.get('From') as string || '';
    const to = formData.get('To') as string || '';
    const messageSid = formData.get('MessageSid') as string || '';

    console.log(`[twilio-webhook] Incoming SMS from=${from} to=${to} sid=${messageSid}`);
    console.log(`[twilio-webhook] Body: ${body}`);

    // Parse the SMS for order status
    const parsed = parseToastSMS(body);
    console.log(`[twilio-webhook] Parsed: status=${parsed.status}, confirmation=${parsed.confirmationNumber}, isOrderUpdate=${parsed.isOrderUpdate}`);

    if (!parsed.isOrderUpdate) {
      console.log('[twilio-webhook] Not an order update, ignoring');
      return twimlResponse();
    }

    // Find the matching order
    let order: typeof dineInOrders.$inferSelect | null = null;

    // Primary: match by confirmation number in metadata
    if (parsed.confirmationNumber) {
      const results = await db
        .select()
        .from(dineInOrders)
        .where(
          eq(
            dineInOrders.metadata as unknown as ReturnType<typeof eq extends (a: infer A, ...args: unknown[]) => unknown ? () => A : never>,
            undefined as never // TypeScript workaround — we use raw SQL below
          )
        )
        .limit(1);

      // Use raw approach: query orders with matching confirmation number in metadata
      // Since Drizzle jsonb querying is complex, use a simpler approach
      if (results.length === 0) {
        // Fallback: find by confirmation number stored in metadata
        const allActive = await db
          .select()
          .from(dineInOrders)
          .where(
            inArray(dineInOrders.orderStatus, ['requested_to_toast', 'toast_ordered', 'confirmed'])
          )
          .orderBy(desc(dineInOrders.createdAt))
          .limit(20);

        order = allActive.find(o => {
          const meta = o.metadata as Record<string, unknown> | null;
          return meta?.confirmationNumber === parsed.confirmationNumber;
        }) || null;
      }
    }

    // Fallback: most recent active order
    if (!order) {
      const [recent] = await db
        .select()
        .from(dineInOrders)
        .where(
          inArray(dineInOrders.orderStatus, ['requested_to_toast', 'toast_ordered', 'confirmed'])
        )
        .orderBy(desc(dineInOrders.createdAt))
        .limit(1);

      order = recent || null;
    }

    if (!order) {
      console.log('[twilio-webhook] No matching order found');
      return twimlResponse();
    }

    console.log(`[twilio-webhook] Matched order ${order.id}`);

    // Get guest phone from order metadata
    const meta = (order.metadata as Record<string, unknown>) || {};
    const guestPhone = (meta.phoneNumber as string) || '';

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
    if (guestPhone && parsed.status !== 'unknown') {
      await sendStatusUpdateSMS({
        guestPhone,
        status: parsed.status,
        confirmationNumber: parsed.confirmationNumber || undefined,
      });
      console.log(`[twilio-webhook] Forwarded status "${parsed.status}" to guest ${guestPhone}`);
    }

    return twimlResponse();
  } catch (error) {
    console.error('[twilio-webhook] Error:', error);
    // Always return 200 to prevent Twilio retries
    return twimlResponse();
  }
}
