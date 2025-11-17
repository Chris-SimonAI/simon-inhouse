import { NextRequest, NextResponse } from 'next/server';
import 'server-only';

export const runtime = 'nodejs';

import { db } from '@/db';
import { dineInOrderItems, dineInOrders, dineInPayments, dineInRestaurants, hotels } from '@/db/schemas';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { createError } from '@/lib/utils';
import { prepareBotPayload, sendOrderToBot } from '@/lib/sqs';


export async function POST(req: NextRequest) {
  try {
    const { stripe } = await import('@/lib/stripe');
    
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;


    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Webhook received:', { type: event.type, id: event.id });

    // Handle the event
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        // Payment authorized but not yet captured (manual capture)
        await handlePaymentIntentAuthorized(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.succeeded':
        // Payment captured and succeeded
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentIntentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.amount_capturable_updated (authorized):', paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error('No orderId in payment intent metadata');
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      console.error('Invalid orderId in payment intent metadata:', orderId);
      return;
    }

    // Check if order exists
    const order = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderIdNum)).limit(1);
    if (order.length === 0) {
      console.error('Order not found:', orderIdNum);
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
      console.error('Hotel not found:', order[0].hotelId);
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

    // Send order to bot via SQS (use mock in development)
    console.log('Sending order to bot via SQS...');
    const botResult = await sendOrderToBot(botPayload);
    if (!botResult.ok) {
      console.error('Failed to send order to bot:', botResult.message || 'Unknown error');
      console.error('Bot result details:', botResult);
      // Don't fail the payment - just log the error
      // The order will remain in pending status
    } else {
      console.log('Order sent to bot for processing successfully:', {
        orderIdNum,
        messageId: botResult.data.messageId,
      });

      // Update order status to requested_to_toast and metadata to indicate bot was triggered
      await db.update(dineInOrders)
        .set({
          orderStatus: 'requested_to_toast',
          metadata: {
            ...(order[0].metadata as Record<string, unknown> || {}),
            botTriggered: true,
            botJobId: botResult.data.messageId,
            botStatus: 'processing',
          } as Record<string, unknown>,
        })
        .where(eq(dineInOrders.id, orderIdNum));
    }

    console.log('Payment authorized and bot triggered for order:', orderIdNum);
    
  } catch (error) {
    console.error('Error handling payment_intent.amount_capturable_updated:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.succeeded (captured):', paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error('No orderId in payment intent metadata');
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      console.error('Invalid orderId in payment intent metadata:', orderId);
      return;
    }

    // Check if order exists
    const order = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderIdNum)).limit(1);
    if (order.length === 0) {
      console.error('Order not found:', orderIdNum);
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling payment_intent.succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.payment_failed:', paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error('No orderId in payment intent metadata');
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      console.error('Invalid orderId in payment intent metadata:', orderId);
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
    
  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
  }
}

// We are marking the order as failed because we are cancelling the payment intent when the bot fails to process the order
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.canceled:', paymentIntent.id);
    
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      console.error('No orderId in payment intent metadata');
      return;
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      console.error('Invalid orderId in payment intent metadata:', orderId);
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
    
  } catch (error) {
    console.error('Error handling payment_intent.canceled:', error);
  }
}
