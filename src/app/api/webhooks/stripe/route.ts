import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import "server-only";

export const runtime = 'nodejs';

import { db } from '@/db';
import { dineInOrderItems, dineInOrders, dineInPayments, dineInRestaurants, hotels, tips } from '@/db/schemas';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { createError } from '@/lib/utils';
import { prepareBotPayload, type BotOrderPayload } from '@/lib/sqs';
import { placeToastOrder, type OrderRequest } from '@/lib/bot/order-agent';
import { TIP_PAYMENT_STATUS, type TipPaymentStatus } from '@/constants/payments';
import { env } from '@/env';
import { getPaymentInfo } from '@/lib/bot/get-payment-info';
import { getTwilioPhoneNumber } from '@/lib/twilio';
import { sendOrderConfirmationSMS } from '@/lib/notifications';
import { AnalyticsEvents } from "@/lib/analytics/events";
import { PostHogServerClient } from "@/lib/analytics/posthog/server";
import { getOrCreateGuestProfile, markGuestIntroduced } from "@/actions/guest-profiles";
import { sendSMS, isTwilioEnabled } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const { stripe } = await import("@/lib/stripe");
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing Stripe signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;


    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
    }

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("Webhook received:", { type: event.type, id: event.id });

    // Handle the event
    switch (event.type) {
      case "payment_intent.amount_capturable_updated":
        // Payment authorized but not yet captured (manual capture)
        await handlePaymentIntentAuthorized(event.data.object as Stripe.PaymentIntent);
        break;
      
      case "payment_intent.succeeded":
        // Payment captured and succeeded
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function captureStripeAnalytics(
  paymentIntent: Stripe.PaymentIntent,
  event: string,
  props: Record<string, unknown>
) {
  const metadata = (paymentIntent.metadata as Record<string, string>) || {};
  const distinctId = metadata.userId

  try {
    void PostHogServerClient.capture(distinctId, event, {
      payment_intent_id: paymentIntent.id,
      ...props,
    });
  } catch (err) {
    console.error("Failed to capture analytics event", { event, err });
  }
}

async function updateTipFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  status: TipPaymentStatus
): Promise<void> {
  const tipIdMeta = (paymentIntent.metadata as Record<string, string> | undefined)?.tipId;
  if (!tipIdMeta) {
    console.error("No tipId in payment intent metadata");
    return;
  }
  const tipIdNum = parseInt(tipIdMeta, 10);
  if (Number.isNaN(tipIdNum)) {
    console.error("Invalid tipId in payment intent metadata:", tipIdMeta);
    return;
  }

  const mergedMetadata: Record<string, unknown> = {
    ...(paymentIntent.metadata || {}),
    stripeStatus: paymentIntent.status,
  };

  if (status === TIP_PAYMENT_STATUS.completed) {
    mergedMetadata.chargeId = paymentIntent.latest_charge;
  } else {
    mergedMetadata.last_payment_error = paymentIntent.last_payment_error;
  }

  await db
    .update(tips)
    .set({
      paymentStatus: status,
      transactionId: paymentIntent.id,
      updatedAt: new Date(),
      metadata: mergedMetadata as Record<string, unknown>,
    })
    .where(eq(tips.id, tipIdNum));

  console.log(`Tip marked as ${status}:`, tipIdNum);

  if (status === TIP_PAYMENT_STATUS.completed) {
    captureStripeAnalytics(paymentIntent, AnalyticsEvents.tipPaymentSucceeded, {
      tip_id: tipIdNum,
      amount: paymentIntent.amount_received / 100,
      currency: paymentIntent.currency,
      payment_status: paymentIntent.status,
    });
  } else if (status === TIP_PAYMENT_STATUS.failed) {
    captureStripeAnalytics(paymentIntent, AnalyticsEvents.tipPaymentFailed, {
      tip_id: tipIdNum,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      payment_status: paymentIntent.status,
      last_error: paymentIntent.last_payment_error,
    });
  }
  return;
}

async function handlePaymentIntentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("Processing payment_intent.amount_capturable_updated (authorized):", paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error("No orderId in payment intent metadata");
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (Number.isNaN(orderIdNum)) {
      console.error("Invalid orderId in payment intent metadata:", orderId);
      return;
    }

    // Check if order exists
    const order = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderIdNum)).limit(1);
    if (order.length === 0) {
      console.error("Order not found:", orderIdNum);
      return;
    }

    // Guard: Only trigger bot for pending orders
    if (order[0].orderStatus !== 'pending') {
      console.log('Skipping bot trigger: order is not pending', {
        orderId: orderIdNum,
        orderStatus: order[0].orderStatus,
      });
      return;
    }

    // Check if payment record already exists
    const existingPayment = await db.select()
      .from(dineInPayments)
      .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id))
      .limit(1);

    if (existingPayment.length === 0) {
      // Create payment record with 'authorized' status
      await db.insert(dineInPayments).values({
        orderId: orderIdNum,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: 'authorized',
        stripeMetadata: {
          ...paymentIntent.metadata,
          chargeId: paymentIntent.latest_charge,
        } as Record<string, unknown>,
      });
      console.log('Payment record created with authorized status for order:', orderIdNum);
    } else if (existingPayment[0].paymentStatus === 'processing') {
      // Update existing payment to authorized status
      await db.update(dineInPayments)
        .set({ 
          paymentStatus: 'authorized',
          stripeMetadata: {
            ...(existingPayment[0].stripeMetadata as Record<string, unknown> || {}),
            chargeId: paymentIntent.latest_charge,
          } as Record<string, unknown>,
          updatedAt: new Date()
        })
        .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id));
      console.log('Payment record updated to authorized status for order:', orderIdNum);
    } else {
      return;
    }

    // Guard: Ensure this is a dine_in intent (not a tip or other)
    const metaType = paymentIntent.metadata.type;
    if (metaType !== 'dine_in') {
      console.log('Skipping bot trigger: payment intent type is not dine_in', {
        paymentIntentId: paymentIntent.id,
        type: metaType,
      });
      return;
    }

    // Guard: Ensure metadata.source matches current environment
    const piSource = paymentIntent.metadata.source;
    if (piSource !== env.NODE_ENV) {
      console.log('Skipping bot trigger: payment intent source does not match environment', {
        paymentIntentId: paymentIntent.id,
        source: piSource,
        expected: env.NODE_ENV,
      });
      return;
    }

    // Get restaurant details for bot payload
    const [restaurant] = await db.select().from(dineInRestaurants).where(eq(dineInRestaurants.id, order[0].restaurantId)).limit(1);
    if (!restaurant) {
      return createError('Restaurant not found');
    }
    console.log('Restaurant found:', {
      restaurantId: restaurant.id,
      name: restaurant.name,
      hasOrderingUrl: !!(restaurant.metadata as Record<string, unknown>)?.sourceUrl
    });
    
    // Get order items for bot payload
    const orderItems = await db.select({
      itemName: dineInOrderItems.itemName,
      quantity: dineInOrderItems.quantity,
      modifierDetails: dineInOrderItems.modifierDetails,
    }).from(dineInOrderItems).where(eq(dineInOrderItems.orderId, orderIdNum));
    // Extract restaurant URL from metadata
    const restaurantUrl = (restaurant.metadata as Record<string, unknown>)?.sourceUrl as string;
    if (!restaurantUrl) {
      return createError('Restaurant ordering URL not configured');
    }

    const hotel = await db.select().from(hotels).where(eq(hotels.id, order[0].hotelId)).limit(1);
    if (hotel.length === 0) {
      console.error("Hotel not found:", order[0].hotelId);
      return;
    }

    const hotelAddress = hotel[0].address;
    if (!hotelAddress) {
      console.error('Hotel address not found:', order[0].hotelId);
      return;
    }

    // Prepare bot payload
    const botPayload = prepareBotPayload(
      orderIdNum,
      restaurantUrl,
      orderItems.map(item => ({
        itemName: item.itemName,
        quantity: item.quantity,
        modifierDetails: item.modifierDetails,
      })),
      {
        name: paymentIntent.metadata.fullName,
        email: paymentIntent.metadata.email,
        phone: paymentIntent.metadata.phoneNumber,
      },
      hotelAddress,
      order[0].roomNumber
    );

    console.log('Bot payload (JSON):', JSON.stringify(botPayload, null, 2));

    // Update order status to requested_to_toast
    await db.update(dineInOrders)
      .set({
        orderStatus: 'requested_to_toast',
        metadata: {
          ...(order[0].metadata as Record<string, unknown> || {}),
          botTriggered: true,
          botStatus: 'processing',
        } as Record<string, unknown>,
      })
      .where(
        and(
          eq(dineInOrders.id, orderIdNum),
          eq(dineInOrders.orderStatus, 'pending')
        )
      );

    console.log('Payment authorized, launching inline bot for order:', orderIdNum);

    // Fire-and-forget: run inline bot asynchronously
    // Don't await — webhook must return 200 quickly
    runInlineBot(orderIdNum, botPayload, order[0]).catch(err => {
      console.error(`[inline-bot] Unhandled error for order ${orderIdNum}:`, err);
    });

    captureStripeAnalytics(paymentIntent, AnalyticsEvents.dineInPaymentAuthorized, {
      order_id: orderIdNum,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      hotel_id: order[0].hotelId,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      stripe_status: paymentIntent.status,
    });
    
  } catch (error) {
    console.error("Error handling payment_intent.amount_capturable_updated:", error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("Processing payment_intent.succeeded (captured):", paymentIntent.id);
    const metaType = (paymentIntent.metadata as Record<string, string> | undefined)?.type;
    if (metaType === 'tip') {
      await updateTipFromPaymentIntent(paymentIntent, TIP_PAYMENT_STATUS.completed);
      return;
    }

    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error("No orderId in payment intent metadata");
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (Number.isNaN(orderIdNum)) {
      console.error("Invalid orderId in payment intent metadata:", orderId);
      return;
    }

    // Check if order exists
    const order = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderIdNum)).limit(1);
    if (order.length === 0) {
      console.error("Order not found:", orderIdNum);
      return;
    }

    // Check if payment record already exists
    const existingPayment = await db.select()
      .from(dineInPayments)
      .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id))
      .limit(1);

    if (existingPayment.length === 0) {
      // Create payment record with 'succeeded' status (fallback if webhook fired out of order)
      await db.insert(dineInPayments).values({
        orderId: orderIdNum,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: 'succeeded',
        stripeMetadata: {
          ...paymentIntent.metadata,
          chargeId: paymentIntent.latest_charge,
        } as Record<string, unknown>,
      });
      console.log('Payment record created with succeeded status for order:', orderIdNum);
    } else if (existingPayment[0].paymentStatus !== 'succeeded') {
      // Update existing payment to succeeded status
      await db.update(dineInPayments)
        .set({ 
          paymentStatus: 'succeeded',
          stripeMetadata: {
            ...(existingPayment[0].stripeMetadata as Record<string, unknown> || {}),
            chargeId: paymentIntent.latest_charge,
          } as Record<string, unknown>,
          updatedAt: new Date()
        })
        .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id));
      console.log('Payment record updated to succeeded status for order:', orderIdNum);
    } else {
      return;
    }

    // Update order status to confirmed
    await db.update(dineInOrders)
      .set({ 
        orderStatus: 'confirmed', 
        updatedAt: new Date() 
      })
      .where(eq(dineInOrders.id, orderIdNum));

    console.log('Order fulfilled successfully:', orderIdNum);
    captureStripeAnalytics(paymentIntent, AnalyticsEvents.dineInPaymentSucceeded, {
      order_id: orderIdNum,
      amount: paymentIntent.amount_received / 100,
      currency: paymentIntent.currency,
      stripe_status: paymentIntent.status,
    });

    // Auto-create guest profile + send intro SMS (fire-and-forget)
    autoCreateGuestProfileAndIntro(paymentIntent, order[0].hotelId).catch((err) => {
      console.error("[stripe-webhook] Guest profile/intro error:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling payment_intent.succeeded:", error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("Processing payment_intent.payment_failed:", paymentIntent.id);
    const metaType = (paymentIntent.metadata as Record<string, string> | undefined)?.type;
    if (metaType === 'tip') {
      await updateTipFromPaymentIntent(paymentIntent, TIP_PAYMENT_STATUS.failed);
      return;
    }

    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error("No orderId in payment intent metadata");
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (Number.isNaN(orderIdNum)) {
      console.error("Invalid orderId in payment intent metadata:", orderId);
      return;
    }

    // Create or update payment record
    const existingPayment = await db.select()
      .from(dineInPayments)
      .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id))
      .limit(1);

    if (existingPayment.length === 0) {
      await db.insert(dineInPayments).values({
        orderId: orderIdNum,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: 'failed',
        stripeMetadata: {
          ...(paymentIntent.metadata || {}),
          last_payment_error: paymentIntent.last_payment_error,
        } as Record<string, unknown>,
      });
    } else {
      await db.update(dineInPayments)
        .set({ 
          paymentStatus: 'failed',
          stripeMetadata: {
            ...(existingPayment[0].stripeMetadata as Record<string, unknown> || {}),
            last_payment_error: paymentIntent.last_payment_error,
          } as Record<string, unknown>,
          updatedAt: new Date()
        })
        .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id));
    }

    const [order] = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderIdNum)).limit(1);

    if (order.orderStatus === 'toast_ordered') {
      await db.update(dineInOrders)
        .set({ 
          orderStatus: 'toast_ok_capture_failed', 
          metadata: {
            ...(order.metadata as Record<string, unknown> || {}),
            botStatus: 'capture_failed',
            botError: 'Payment capture failed',
            errorReason: 'Failed to capture payment after ordering',
            botCompletedAt: new Date().toISOString(),
          } as Record<string, unknown>,
        })
        .where(eq(dineInOrders.id, orderIdNum));
    } else {
      // Update order status to failed (closest match to payment_failed)
      await db.update(dineInOrders)
        .set({ 
          orderStatus: 'failed', 
          metadata: {
            ...(order.metadata as Record<string, unknown> || {}),
            botStatus: 'capture_failed',
            botError: 'Payment capture failed',
            errorReason: 'Payment capture failed',
            botCompletedAt: new Date().toISOString(),
          } as Record<string, unknown>,
        })
        .where(eq(dineInOrders.id, orderIdNum));
    }
    console.log('Order marked as payment failed:', orderIdNum);
    captureStripeAnalytics(paymentIntent, AnalyticsEvents.dineInPaymentFailed, {
      order_id: orderIdNum,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      stripe_status: paymentIntent.status,
      last_error: paymentIntent.last_payment_error,
    });
    
  } catch (error) {
    console.error("Error handling payment_intent.payment_failed:", error);
  }
}

// We are marking the order as failed because we are cancelling the payment intent when the bot fails to process the order
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("Processing payment_intent.canceled:", paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error("No orderId in payment intent metadata");
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (Number.isNaN(orderIdNum)) {
      console.error("Invalid orderId in payment intent metadata:", orderId);
      return;
    }

    // Create or update payment record
    const existingPayment = await db.select()
      .from(dineInPayments)
      .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id))
      .limit(1);

    if (existingPayment.length === 0) {
      await db.insert(dineInPayments).values({
        orderId: orderIdNum,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: 'cancelled',
        stripeMetadata: {
          ...(paymentIntent.metadata || {}),
          cancellation_reason: paymentIntent.cancellation_reason,
        } as Record<string, unknown>,
      });
    } else {
      await db.update(dineInPayments)
        .set({ 
          paymentStatus: 'cancelled',
          stripeMetadata: {
            ...(existingPayment[0].stripeMetadata as Record<string, unknown> || {}),
            cancellation_reason: paymentIntent.cancellation_reason,
          } as Record<string, unknown>,
          updatedAt: new Date()
        })
        .where(eq(dineInPayments.stripePaymentIntentId, paymentIntent.id));
    }

    // Update order status to cancelled
    await db.update(dineInOrders)
      .set({ 
        orderStatus: 'failed', 
      })
      .where(eq(dineInOrders.id, orderIdNum));

    console.log('Order cancelled:', orderIdNum);
    captureStripeAnalytics(paymentIntent, AnalyticsEvents.dineInPaymentCanceled, {
      order_id: orderIdNum,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      stripe_status: paymentIntent.status,
      cancellation_reason: paymentIntent.cancellation_reason,
    });
    
  } catch (error) {
    console.error("Error handling payment_intent.canceled:", error);
  }
}

/**
 * Run the inline Playwright bot to place an order on Toast, then
 * capture or cancel the Stripe payment based on the result.
 * This runs fire-and-forget from the webhook handler.
 */
async function runInlineBot(
  orderId: number,
  botPayload: BotOrderPayload,
  order: typeof dineInOrders.$inferSelect,
) {
  const { stripe } = await import("@/lib/stripe");

  try {
    console.log(`[inline-bot] Starting order ${orderId}...`);

    // Convert BotOrderPayload -> OrderRequest
    const guestName = botPayload.guest?.name || "Guest";
    const nameParts = guestName.split(" ");
    const firstName = nameParts[0] || "Guest";
    const lastName = nameParts.slice(1).join(" ") || "Guest";

    let deliveryAddress: OrderRequest["deliveryAddress"];
    if (botPayload.deliveryAddress) {
      const parts = botPayload.deliveryAddress.split(",").map(s => s.trim());
      const street = parts[0] || "";
      const city = parts[1] || "";
      const stateZip = (parts[2] || "").trim().split(/\s+/);
      const state = stateZip[0] || "";
      const zip = stateZip[1] || "";
      deliveryAddress = { street, city, state, zip, apt: botPayload.apartment };
    }

    // Read payment info from DB (falls back to env vars)
    const cardInfo = await getPaymentInfo();

    // Substitute customer phone with Twilio number so Toast sends SMS updates to us
    const twilioPhone = await getTwilioPhoneNumber();
    const originalPhone = botPayload.guest?.phone || "";
    const customerPhone = twilioPhone || originalPhone;
    if (twilioPhone) {
      console.log(`[inline-bot] Using Twilio phone ${twilioPhone} on Toast (guest phone: ${originalPhone})`);
    }

    const orderRequest: OrderRequest = {
      restaurantUrl: botPayload.url,
      items: botPayload.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 1,
        modifiers: item.modifiers,
      })),
      customer: {
        firstName,
        lastName,
        email: botPayload.guest?.email || "guest@meetsimon.com",
        phone: customerPhone,
      },
      payment: cardInfo,
      orderType: deliveryAddress ? "delivery" : "pickup",
      deliveryAddress,
      dryRun: !cardInfo.cardNumber,
    };

    const result = await placeToastOrder(orderRequest);
    console.log(`[inline-bot] Order ${orderId} result:`, JSON.stringify(result));

    // Get payment record for this order
    const [payment] = await db.select().from(dineInPayments).where(eq(dineInPayments.orderId, orderId)).limit(1);
    if (!payment) {
      console.error(`[inline-bot] No payment record found for order ${orderId}`);
      return;
    }

    if (result.success) {
      // Bot succeeded — capture payment
      try {
        await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
        await db.update(dineInOrders)
          .set({
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'success',
              trackingUrl: result.confirmation?.trackingUrl,
              confirmationNumber: result.orderId,
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));
        console.log(`[inline-bot] Payment captured for order ${orderId}`);

        // Send confirmation SMS to guest (fire-and-forget)
        if (originalPhone && twilioPhone) {
          // Get restaurant name for the SMS
          const [restaurant] = await db.select({ name: dineInRestaurants.name })
            .from(dineInRestaurants)
            .where(eq(dineInRestaurants.id, order.restaurantId))
            .limit(1);

          sendOrderConfirmationSMS({
            guestPhone: originalPhone,
            guestName: firstName,
            confirmationNumber: result.orderId || result.confirmation?.confirmationNumber,
            restaurantName: restaurant?.name || 'the restaurant',
          }).catch(err => {
            console.error(`[inline-bot] Failed to send confirmation SMS for order ${orderId}:`, err);
          });
        }
      } catch (captureError) {
        console.error(`[inline-bot] Failed to capture payment for order ${orderId}:`, captureError);
        await db.update(dineInOrders)
          .set({
            orderStatus: 'toast_ok_capture_failed',
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'capture_failed',
              botError: 'Payment capture failed',
              errorReason: 'Payment capture failed after successful Toast order',
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));
      }
    } else {
      // Bot failed — cancel payment
      try {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        await db.update(dineInOrders)
          .set({
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'failed',
              botError: result.message,
              errorReason: result.stage,
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));
        console.log(`[inline-bot] Payment cancelled for failed order ${orderId}`);
      } catch (cancelError) {
        console.error(`[inline-bot] Failed to cancel payment for order ${orderId}:`, cancelError);
        await db.update(dineInOrders)
          .set({
            metadata: {
              ...(order.metadata as Record<string, unknown> || {}),
              botStatus: 'cancel_failed',
              botError: 'Payment cancellation failed',
              errorReason: result.message,
              botCompletedAt: new Date().toISOString(),
            } as Record<string, unknown>,
          })
          .where(eq(dineInOrders.id, orderId));
      }
    }
  } catch (error) {
    console.error(`[inline-bot] Unhandled error for order ${orderId}:`, error);
    await db.update(dineInOrders)
      .set({
        metadata: {
          ...(order.metadata as Record<string, unknown> || {}),
          botStatus: 'error',
          botError: error instanceof Error ? error.message : String(error),
          botCompletedAt: new Date().toISOString(),
        } as Record<string, unknown>,
      })
      .where(eq(dineInOrders.id, orderId));
  }
}

/**
 * Auto-create guest profile from payment metadata and send intro SMS.
 * Fire-and-forget from handlePaymentIntentSucceeded.
 */
async function autoCreateGuestProfileAndIntro(
  paymentIntent: Stripe.PaymentIntent,
  hotelId: number
): Promise<void> {
  const meta = paymentIntent.metadata as Record<string, string>;
  const phone = meta.phoneNumber;
  if (!phone) return;

  const profile = await getOrCreateGuestProfile(phone, {
    name: meta.fullName,
    email: meta.email,
    hotelId,
  });

  // Send intro SMS if this is the first time
  if (!profile.hasBeenIntroduced && await isTwilioEnabled()) {
    const firstName = (profile.name || "").split(" ")[0] || "there";
    const hotelName = meta.hotelName || "our hotel";

    await sendSMS(
      phone,
      `Hi ${firstName}! I'm Simon from ${hotelName}. Text me anytime to order food — I'll remember your favorites! Reply STOP to opt out.`
    );

    await markGuestIntroduced(phone);
    console.log("[stripe-webhook] Intro SMS sent to:", phone);
  }
}
