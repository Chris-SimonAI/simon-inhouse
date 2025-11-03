'use server';

import 'server-only';

import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInPayments, hotels, dineInRestaurants } from '@/db/schemas';
import { createSuccess, createError } from '@/lib/utils';
import { CreateOrderRequestSchema } from '@/validations/dine-in-orders';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { getMenuItemDatabaseId } from '@/actions/menu';

export async function createOrderAndPaymentIntent(input: unknown) {
  try {
    const validatedInput = CreateOrderRequestSchema.parse(input);
    
    const itemsWithDatabaseIds = await Promise.all(
      validatedInput.items.map(async (item) => {
        const databaseId = await getMenuItemDatabaseId(item.menuItemGuid);
        if (!databaseId || databaseId <= 0) {
          throw new Error(`Menu item not found: ${item.itemName} (UUID: ${item.menuItemGuid})`);
        }
        return {
          ...item,
          menuItemId: databaseId
        };
      })
    );

    const totalAmount = itemsWithDatabaseIds.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

    const orderResult = await db.insert(dineInOrders).values({
      hotelId: validatedInput.hotelId,
      restaurantId: validatedInput.restaurantId,
      userId: validatedInput.userId,
      roomNumber: validatedInput.roomNumber,
      specialInstructions: validatedInput.specialInstructions,
      totalAmount: totalAmount.toFixed(2),
      orderStatus: 'pending',
      metadata: {
        fullName: validatedInput.fullName,
        email: validatedInput.email,
        phoneNumber: validatedInput.phoneNumber,
      } as Record<string, unknown>,
    }).returning();

    if (orderResult.length === 0) {
      return createError('Failed to create order');
    }

    const order = orderResult[0];

    const orderItems = await Promise.all(
      itemsWithDatabaseIds.map(async (item) => {
        return db.insert(dineInOrderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          menuItemGuid: item.menuItemGuid,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          basePrice: parseFloat(item.basePrice).toFixed(2),
          modifierPrice: parseFloat(item.modifierPrice).toFixed(2),
          unitPrice: parseFloat(item.unitPrice).toFixed(2),
          quantity: item.quantity,
          totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
          modifierDetails: item.modifierDetails as unknown,
          metadata: {} as Record<string, unknown>,
        }).returning();
      })
    );

    const [hotel, restaurant] = await Promise.all([
      db.select().from(hotels).where(eq(hotels.id, order.hotelId)).limit(1),
      db.select().from(dineInRestaurants).where(eq(dineInRestaurants.id, order.restaurantId)).limit(1)
    ]);
    // Create Stripe Payment Intent (authorize-only for bot processing)
    console.log('Creating Stripe payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Convert to cents
            currency: 'usd',
            capture_method: 'manual', // Authorize but don't capture until bot succeeds
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never'
            },
            metadata: {
              orderId: order.id.toString(),
              hotelId: order.hotelId.toString(),
              restaurantId: order.restaurantId.toString(),
              hotelName: hotel[0]?.name || 'Unknown Hotel',
              restaurantName: restaurant[0]?.name || 'Unknown Restaurant',
              roomNumber: order.roomNumber,
              botTriggered: 'false',
              botStatus: 'pending',
              fullName: validatedInput.fullName,
              email: validatedInput.email,
              phoneNumber: validatedInput.phoneNumber,
            },
          });
    console.log('Stripe payment intent created:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });

    // Revalidate orders cache
    revalidateTag('orders');
    
    console.log('createOrderAndPaymentIntent completed successfully');
    return createSuccess({ 
      order, 
      orderItems, 
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    console.error('Error creating order and payment intent:', error);
    return createError('Failed to create order and payment intent', error);
  }
}

export async function confirmPayment(input: { 
  paymentIntentId: string;
  paymentMethodId: string;
}) {
  try {
    // Retrieve payment intent from Stripe
    console.log('Retrieving payment intent from Stripe...');
    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (!paymentIntent) {
      console.error('Payment intent not found for ID:', input.paymentIntentId);
      return createError('Payment intent not found');
    }


    // Confirm Payment Intent with Payment Method
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      input.paymentIntentId,
      {
        payment_method: input.paymentMethodId,
      }
    );

    if (confirmedPaymentIntent.status !== 'requires_capture') {
      console.error('Payment confirmation failed with status:', confirmedPaymentIntent.status);
      return createError(`Payment failed with status: ${confirmedPaymentIntent.status}`);
    }

    console.log('Payment intent requires capture:', confirmedPaymentIntent.id);

    // Get order from metadata
    const orderIdStr = paymentIntent.metadata.orderId;
    if (!orderIdStr || isNaN(parseInt(orderIdStr))) {
      return createError('Invalid order ID in payment metadata');
    }

    const orderId = parseInt(orderIdStr);
    const order = await db.select().from(dineInOrders).where(eq(dineInOrders.id, orderId)).limit(1);
    if (order.length === 0) {
      return createError('Order not found');
    }

    // Create payment record with 'authorized' status
    // Payment will be captured after bot succeeds
    const paymentRecord = await db.insert(dineInPayments).values({
      orderId: orderId,
      amount: (confirmedPaymentIntent.amount / 100).toFixed(2),
      currency: confirmedPaymentIntent.currency,
      stripePaymentIntentId: confirmedPaymentIntent.id,
      paymentStatus: 'processing', // Will be captured after bot succeeds
      stripeMetadata: {
        ...confirmedPaymentIntent.metadata,
        paymentMethodId: input.paymentMethodId,
        chargeId: confirmedPaymentIntent.latest_charge,
      } as Record<string, unknown>,
    }).returning();

    if (paymentRecord.length === 0) {
      return createError('Failed to create payment record');
    }

    return createSuccess({ payment: paymentRecord[0] });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return createError('Failed to confirm payment', error);
  }
}
