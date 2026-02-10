'use server';

import 'server-only';

import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInPayments, hotels, dineInRestaurants } from '@/db/schemas';
import { createSuccess, createError } from '@/lib/utils';
import { SecureCreateOrderRequestSchema, type SecureOrderItem, type TipOption } from '@/validations/dine-in-orders';
import { eq } from 'drizzle-orm';
import { getActiveDiscount } from '@/actions/dining-discounts';
import { env } from '@/env';
import { getHotelSession } from './sessions';
import { compileCanonicalOrderRequest } from '@/lib/orders/canonical-order-compiler-server';
import { type CompiledOrderItem } from '@/lib/orders/canonical-order-compiler';
import {
  buildCanonicalOrderArtifact,
  canonicalCompilerVersion,
} from '@/lib/orders/canonical-order-artifact';
import { dispatchOrderCreatedAlert } from '@/lib/orders/order-alerts';
import { buildOrderCreatedAlertPayload } from '@/lib/orders/order-alerts-shared';

/**
 * Result of server-side order total calculation
 */
export type OrderTotalBreakdown = {
  // Item-level details (for order storage)
  items: CompiledOrderItem[];
  // Totals
  subtotal: number;          // Sum of all item prices
  serviceFee: number;        // subtotal * serviceFeePercent / 100
  deliveryFee: number;       // Flat amount from restaurant
  discount: number;          // subtotal * discountPercent / 100
  discountPercentage: number;// Discount percentage (from session)
  tip: number;               // Based on tipOption (percentage of subtotal or fixed)
  total: number;             // subtotal - discount + serviceFee + deliveryFee + tip
  // Restaurant info
  restaurantId: number;
  hotelId: number;
};

/**
 * Calculate order total with server-side price lookups
 * 
 * SECURITY: This function fetches all prices from the database.
 * The client only provides item IDs and quantities - no prices are trusted from the client.
 * 
 * Calculation order:
 * 1. subtotal = sum of (item base price + modifier prices) * quantity
 * 2. serviceFee = subtotal * serviceFeePercent / 100
 * 3. deliveryFee = flat amount from restaurant
 * 4. discount = subtotal * discountPercent / 100 (from session)
 * 5. tip = subtotal * tipPercent / 100 (if percentage) or fixed amount
 * 6. total = subtotal - discount + serviceFee + deliveryFee + tip
 */
export async function calculateOrderTotal(
  restaurantGuid: string,
  items: SecureOrderItem[],
  tipOption: TipOption
): Promise<ReturnType<typeof createSuccess<OrderTotalBreakdown>> | ReturnType<typeof createError>> {
  try {
    const compileResult = await compileCanonicalOrderRequest(restaurantGuid, items);
    if (!compileResult.ok) {
      return createError(compileResult.message);
    }

    const compileData = compileResult.data;
    if (compileData.status === 'needs_user_input') {
      return createError('Order is missing required selections', compileData.issues);
    }

    if (compileData.status === 'unfulfillable') {
      return createError('Order cannot be fulfilled with the current menu', compileData.issues);
    }

    if (compileData.hotelId === null) {
      return createError('Restaurant is not linked to a hotel');
    }

    const subtotal = compileData.subtotal;
    const serviceFee = Math.round((subtotal * compileData.serviceFeePercent / 100) * 100) / 100;
    const deliveryFee = compileData.deliveryFee;

    // 7. Get discount from session
    const discountResult = await getActiveDiscount();
    let discountPercentage = 0;
    if (discountResult.ok && discountResult.data) {
      discountPercentage = discountResult.data.discountPercent;
    }
    const discount = Math.round((subtotal * discountPercentage / 100) * 100) / 100;

    // 8. Calculate tip (on original subtotal, before discount and fees)
    const subtotalAfterDiscount = subtotal - discount;
    let tip = 0;
    if (tipOption.type === 'percentage') {
      tip = Math.round((subtotal * tipOption.value / 100) * 100) / 100;
    } else {
      tip = Math.round(tipOption.value * 100) / 100;
    }

    // 9. Calculate total
    const total = Math.round((subtotalAfterDiscount + serviceFee + deliveryFee + tip) * 100) / 100;

    return createSuccess({
      items: compileData.items,
      subtotal,
      serviceFee,
      deliveryFee,
      discount,
      discountPercentage,
      tip,
      total,
      restaurantId: compileData.restaurantId,
      hotelId: compileData.hotelId,
    });
  } catch (error) {
    console.error('Error calculating order total:', error);
    return createError('Failed to calculate order total');
  }
}

/**
 * SECURE: Create order and payment intent with server-side price calculation
 * 
 * This is the secure version that does not trust client-provided prices.
 * All prices are calculated server-side from database lookups.
 */
export async function createSecureOrderAndPaymentIntent(input: unknown) {
  try {
    const sessionResult = await getHotelSession();
    if (!sessionResult.ok || !sessionResult.data) {
      return createError("No active session found");
    }

    const { userId } = sessionResult.data;

    // 1. Validate input using secure schema (no prices)
    const validatedInput = SecureCreateOrderRequestSchema.parse(input);

    console.log('[stripe][secureCreate] input:validated', {
      env: env.NODE_ENV,
      restaurantGuid: validatedInput.restaurantGuid,
      userId,
      roomNumber: validatedInput.roomNumber,
      fullNameProvided: Boolean(validatedInput.fullName),
      email: validatedInput.email,
      phoneNumber: validatedInput.phoneNumber,
      items: validatedInput.items.map((it) => ({
        menuItemGuid: it.menuItemGuid,
        quantity: it.quantity,
        selectedModifierGroupCount: Object.keys(it.selectedModifiers || {}).length,
        selectedModifierOptionCount: Object.values(it.selectedModifiers || {}).reduce(
          (sum, arr) => sum + arr.length,
          0,
        ),
      })),
      tipOption: validatedInput.tipOption,
    });
    
    // 2. Calculate order total server-side
    const calculationResult = await calculateOrderTotal(
      validatedInput.restaurantGuid,
      validatedInput.items,
      validatedInput.tipOption
    );
    
    if (!calculationResult.ok) {
      console.error('[stripe][secureCreate] total:calculation:failed', {
        env: env.NODE_ENV,
        restaurantGuid: validatedInput.restaurantGuid,
        userId,
        message: calculationResult.message ?? 'Unknown error',
      });
      return createError('Failed to calculate order total');
    }
    
    const calculation = calculationResult.data;
    const canonicalOrder = buildCanonicalOrderArtifact(
      calculation.items,
      calculation.subtotal,
    );

    console.log('[stripe][secureCreate] total:calculation:success', {
      env: env.NODE_ENV,
      restaurantGuid: validatedInput.restaurantGuid,
      restaurantId: calculation.restaurantId,
      hotelId: calculation.hotelId,
      totals: {
        subtotal: calculation.subtotal,
        serviceFee: calculation.serviceFee,
        deliveryFee: calculation.deliveryFee,
        discount: calculation.discount,
        discountPercentage: calculation.discountPercentage,
        tip: calculation.tip,
        total: calculation.total,
      },
      itemCount: calculation.items.length,
    });

    // 3. Create order with server-calculated values
    const orderResult = await db.insert(dineInOrders).values({
      hotelId: calculation.hotelId,
      restaurantId: calculation.restaurantId,
      userId,
      roomNumber: validatedInput.roomNumber,
      specialInstructions: validatedInput.specialInstructions,
      totalAmount: calculation.total.toFixed(2),
      orderStatus: 'pending',
      metadata: {
        fullName: validatedInput.fullName,
        email: validatedInput.email,
        phoneNumber: validatedInput.phoneNumber,
        canonicalOrder,
        paymentBreakdown: {
          subtotal: calculation.subtotal,
          serviceFee: calculation.serviceFee,
          deliveryFee: calculation.deliveryFee,
          discount: calculation.discount,
          discountPercentage: calculation.discountPercentage,
          tip: calculation.tip,
          total: calculation.total,
        },
      } as Record<string, unknown>,
    }).returning();

    if (orderResult.length === 0) {
      console.error('[stripe][secureCreate] order:insert:failed', {
        env: env.NODE_ENV,
        restaurantGuid: validatedInput.restaurantGuid,
        userId,
      });
      return createError('Failed to create order');
    }

    const order = orderResult[0];

    console.log('[stripe][secureCreate] order:insert:success', {
      env: env.NODE_ENV,
      orderId: order.id,
      hotelId: order.hotelId,
      restaurantId: order.restaurantId,
      userId,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
    });

    // 4. Create order items with server-calculated prices
    const orderItems = await Promise.all(
      calculation.items.map(async (item) => {
        return db.insert(dineInOrderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          menuItemGuid: item.menuItemGuid,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          basePrice: item.basePrice.toFixed(2),
          modifierPrice: item.modifierPrice.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          totalPrice: item.totalPrice.toFixed(2),
          modifierDetails: item.modifierDetails as unknown,
          metadata: {} as Record<string, unknown>,
        }).returning();
      })
    );

    // 5. Get hotel and restaurant names for Stripe metadata
    const [hotel, restaurant] = await Promise.all([
      db.select().from(hotels).where(eq(hotels.id, order.hotelId)).limit(1),
      db.select().from(dineInRestaurants).where(eq(dineInRestaurants.id, order.restaurantId)).limit(1)
    ]);

    // 5b. Fire-and-forget: notify ops a new order was created.
    // Never fail the order flow if notifications fail.
    try {
      const hotelRow = hotel[0];
      const restaurantRow = restaurant[0];

      if (hotelRow && restaurantRow) {
        const payload = buildOrderCreatedAlertPayload({
          orderId: order.id,
          orderStatus: order.orderStatus,
          hotel: {
            id: hotelRow.id,
            name: hotelRow.name,
            slug: hotelRow.slug ?? null,
          },
          restaurant: { id: restaurantRow.id, name: restaurantRow.name },
          guest: {
            name: validatedInput.fullName,
            phone: validatedInput.phoneNumber,
            email: validatedInput.email,
            roomNumber: validatedInput.roomNumber,
          },
          totalAmount: order.totalAmount,
          metadata: order.metadata,
          fallbackItems: calculation.items.map((it) => ({
            name: it.itemName,
            quantity: it.quantity,
            modifiers: it.modifierDetails.flatMap((group) =>
              group.options.map((opt) => opt.optionName),
            ),
          })),
          adminBaseUrl: env.NEXT_PUBLIC_APP_URL,
        });

        await dispatchOrderCreatedAlert(payload);
      }
    } catch (error) {
      console.error('[stripe][secureCreate] order:alert:failed', {
        env: env.NODE_ENV,
        orderId: order.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // 6. Create Stripe Payment Intent with server-calculated amount
    const paymentIntentCreateParams = {
      amount: Math.round(calculation.total * 100), // Convert to cents
      currency: 'usd',
      capture_method: 'manual', // Authorize but don't capture until bot succeeds
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        type: 'dine_in',
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
        subtotal: calculation.subtotal.toString(),
        serviceFee: calculation.serviceFee.toString(),
        deliveryFee: calculation.deliveryFee.toString(),
        discount: calculation.discount.toString(),
        discountPercentage: calculation.discountPercentage.toString(),
        tip: calculation.tip.toString(),
        total: calculation.total.toString(),
        compilerVersion: canonicalCompilerVersion,
        compilerItemCount: calculation.items.length.toString(),
        source: env.NODE_ENV,
        userId: userId,
      },
    } as const;

    console.log('Creating Stripe payment intent (secure)...', {
      env: env.NODE_ENV,
      orderId: order.id,
      restaurantId: order.restaurantId,
      hotelId: order.hotelId,
      paymentIntentCreateParams: {
        amount: paymentIntentCreateParams.amount,
        currency: paymentIntentCreateParams.currency,
        capture_method: paymentIntentCreateParams.capture_method,
        automatic_payment_methods: paymentIntentCreateParams.automatic_payment_methods,
        metadata: paymentIntentCreateParams.metadata,
      },
    });

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentCreateParams);
    
    console.log('Stripe payment intent created (secure):', {
      env: env.NODE_ENV,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });

    
    console.log('createSecureOrderAndPaymentIntent completed successfully');
    return createSuccess({ 
      order, 
      orderItems,
      calculation, // Include the full breakdown for the client
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    console.error('Error creating secure order and payment intent:', error);
    return createError('Failed to create order and payment intent');
  }
}

export async function confirmPayment(input: { 
  paymentIntentId: string;
  paymentMethodId: string;
}) {
  try {
    console.log('[stripe][confirmPayment] request', {
      env: env.NODE_ENV,
      paymentIntentId: input.paymentIntentId,
      paymentMethodId: input.paymentMethodId,
    });

    // Retrieve payment intent from Stripe
    console.log('Retrieving payment intent from Stripe...');
    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

    if (!paymentIntent) {
      console.error('Payment intent not found for ID:', input.paymentIntentId);
      return createError('Payment intent not found');
    }

    console.log('[stripe][confirmPayment] paymentIntent:retrieved', {
      env: env.NODE_ENV,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      capture_method: paymentIntent.capture_method,
      customer: paymentIntent.customer ?? null,
      metadata: paymentIntent.metadata || {},
    });

    // Confirm Payment Intent with Payment Method
    console.log('[stripe][confirmPayment] paymentIntent:confirm:request', {
      env: env.NODE_ENV,
      paymentIntentId: input.paymentIntentId,
      payment_method: input.paymentMethodId,
    });

    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      input.paymentIntentId,
      {
        payment_method: input.paymentMethodId,
      }
    );

    console.log('[stripe][confirmPayment] paymentIntent:confirm:response', {
      env: env.NODE_ENV,
      paymentIntentId: confirmedPaymentIntent.id,
      status: confirmedPaymentIntent.status,
      amount: confirmedPaymentIntent.amount,
      currency: confirmedPaymentIntent.currency,
      latest_charge: confirmedPaymentIntent.latest_charge ?? null,
      last_payment_error: confirmedPaymentIntent.last_payment_error
        ? {
            code: confirmedPaymentIntent.last_payment_error.code ?? null,
            type: confirmedPaymentIntent.last_payment_error.type ?? null,
            message: confirmedPaymentIntent.last_payment_error.message ?? null,
            decline_code: confirmedPaymentIntent.last_payment_error.decline_code ?? null,
          }
        : null,
      payment_method: confirmedPaymentIntent.payment_method ?? null,
    });

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

    console.log('[stripe][confirmPayment] paymentRecord:created', {
      env: env.NODE_ENV,
      paymentId: paymentRecord[0]?.id,
      orderId,
      paymentStatus: paymentRecord[0]?.paymentStatus,
      stripePaymentIntentId: paymentRecord[0]?.stripePaymentIntentId,
      paymentMethodId: input.paymentMethodId,
    });

    return createSuccess({ payment: paymentRecord[0] });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return createError('Failed to confirm payment', error);
  }
}
