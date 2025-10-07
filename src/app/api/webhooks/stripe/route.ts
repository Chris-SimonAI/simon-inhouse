import { NextRequest, NextResponse } from 'next/server';
import 'server-only';

export const runtime = 'nodejs';

import { db } from '@/db';
import { dineInOrders, dineInPayments } from '@/db/schemas';
import { eq } from 'drizzle-orm';
import { processOrderFulfillment } from '@/actions/fulfillment';
import Stripe from 'stripe';

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
      case 'payment_intent.succeeded':
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

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.succeeded:', paymentIntent.id);
    
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
      // Create payment record
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
    }

    // Update order status to confirmed
    await db.update(dineInOrders)
      .set({ 
        orderStatus: 'confirmed', 
        updatedAt: new Date() 
      })
      .where(eq(dineInOrders.id, orderIdNum));

    console.log('Order fulfilled successfully:', orderIdNum);
    
    // Trigger fulfillment processes
    try {
      const fulfillmentResult = await processOrderFulfillment(orderIdNum);
      if (fulfillmentResult.ok) {
        console.log('Fulfillment process initiated for order:', orderIdNum);
      } else {
        console.error('Failed to initiate fulfillment process:', fulfillmentResult.message);
      }
    } catch (error) {
      console.error('Error initiating fulfillment process:', error);
    }
    
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

    // Update order status to cancelled (closest match to payment_failed)
    await db.update(dineInOrders)
      .set({ 
        orderStatus: 'cancelled', 
        updatedAt: new Date() 
      })
      .where(eq(dineInOrders.id, orderIdNum));

    console.log('Order marked as payment failed:', orderIdNum);
    
  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
  }
}

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
        orderStatus: 'cancelled', 
        updatedAt: new Date() 
      })
      .where(eq(dineInOrders.id, orderIdNum));

    console.log('Order cancelled:', orderIdNum);
    
  } catch (error) {
    console.error('Error handling payment_intent.canceled:', error);
  }
}
