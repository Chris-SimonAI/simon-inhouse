import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { dineInOrders, dineInPayments } from '@/db/schemas';
import { eq } from 'drizzle-orm';
import { env } from '@/env';

interface BotCallbackPayload {
  orderId: number;
  success: boolean;
  data?: unknown;
  error?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate callback secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = `Bearer ${env.FULFILLMENT_CALLBACK_SECRET}`;
    
    if (authHeader !== expectedSecret) {
      console.error('Invalid callback secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse bot result
    const payload: BotCallbackPayload = await request.json();
    const { orderId, success, error, reason } = payload;

    console.log('Received bot callback:', { orderId, success, error, reason });

    // Get order and payment details
    const [order] = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderId)).limit(1);
    if (!order) {
      console.error('Order not found:', orderId);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const [payment] = await db.select().from(dineInPayments).where(eq(dineInPayments.orderId, orderId)).limit(1);
    if (!payment) {
      console.error('Payment not found for order:', orderId);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (success) {
      // Bot succeeded - capture payment
      try {
        await stripe.paymentIntents.capture(payment.stripePaymentIntentId);

      } catch (captureError) {
        console.error('Failed to capture payment:', captureError);
        
        // Update order status to toast_ok_capture_failed and metadata
        await db.update(dineInOrders)
          .set({
            orderStatus: 'toast_ok_capture_failed',
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'capture_failed',
              botError: 'Payment capture failed',
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));

        return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 });
      }
    } else {
      // Bot failed - cancel/void payment
      try {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch (cancelError) {
        console.error('Failed to cancel payment:', cancelError);
        
        // Update order with cancel failure
        await db.update(dineInOrders)
          .set({
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'cancel_failed',
              botError: 'Payment cancellation failed',
              botReason: reason,
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));

        return NextResponse.json({ error: 'Payment cancellation failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Callback processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
