'use server';

import 'server-only';

import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInPayments, hotels, dineInRestaurants, menuItems, modifierOptions } from '@/db/schemas';
import { createSuccess, createError } from '@/lib/utils';
import { SecureCreateOrderRequestSchema, type SecureOrderItem, type TipOption } from '@/validations/dine-in-orders';
import { eq, inArray } from 'drizzle-orm';
import { getActiveDiscount } from '@/actions/dining-discounts';
import { env } from '@/env';
import { getHotelSession } from './sessions';

/**
 * Result of server-side order total calculation
 */
export type OrderTotalBreakdown = {
  // Item-level details (for order storage)
  items: Array<{
    menuItemId: number;
    menuItemGuid: string;
    itemName: string;
    itemDescription: string;
    basePrice: number;
    modifierPrice: number;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    modifierDetails: Array<{
      groupId: string;
      groupName: string;
      options: Array<{
        optionId: string;
        optionName: string;
        optionPrice: string;
      }>;
    }>;
  }>;
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
    // 1. Get restaurant info (including fees)
    const [restaurant] = await db
      .select({
        id: dineInRestaurants.id,
        hotelId: dineInRestaurants.hotelId,
        deliveryFee: dineInRestaurants.deliveryFee,
        serviceFeePercent: dineInRestaurants.serviceFeePercent,
      })
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.restaurantGuid, restaurantGuid))
      .limit(1);

    if (!restaurant) {
      return createError('Restaurant not found');
    }

    // Convert decimal strings to numbers for calculations
    const deliveryFee = parseFloat(restaurant.deliveryFee);
    const serviceFeePercent = parseFloat(restaurant.serviceFeePercent);

    // 2. Get all menu item GUIDs from the request
    const menuItemGuids = items.map(item => item.menuItemGuid);
    
    // 3. Fetch menu items from database
    const dbMenuItems = await db
      .select({
        id: menuItems.id,
        menuItemGuid: menuItems.menuItemGuid,
        name: menuItems.name,
        description: menuItems.description,
        price: menuItems.price,
      })
      .from(menuItems)
      .where(inArray(menuItems.menuItemGuid, menuItemGuids));

    // Create a map for quick lookup
    const menuItemMap = new Map(
      dbMenuItems.map(item => [item.menuItemGuid, item])
    );

    // 4. Collect all modifier option GUIDs from all items
    const allModifierOptionGuids: string[] = [];
    for (const item of items) {
      for (const optionGuids of Object.values(item.selectedModifiers)) {
        allModifierOptionGuids.push(...optionGuids);
      }
    }

    // 5. Fetch all modifier options from database (if any)
    let modifierOptionMap = new Map<string, { id: number; name: string; price: string; modifierGroupId: number }>();
    
    if (allModifierOptionGuids.length > 0) {
      const dbModifierOptions = await db
        .select({
          id: modifierOptions.id,
          modifierOptionGuid: modifierOptions.modifierOptionGuid,
          modifierGroupId: modifierOptions.modifierGroupId,
          name: modifierOptions.name,
          price: modifierOptions.price,
        })
        .from(modifierOptions)
        .where(inArray(modifierOptions.modifierOptionGuid, allModifierOptionGuids));

      modifierOptionMap = new Map(
        dbModifierOptions.map(opt => [opt.modifierOptionGuid, {
          id: opt.id,
          name: opt.name,
          // price for a modifier can be null, indicating a free modifier
          // this is why we need to use ?? to handle null values
          price: opt.price ?? '0',
          modifierGroupId: opt.modifierGroupId,
        }])
      );
    }

    // 6. Calculate item prices and build order items
    const calculatedItems: OrderTotalBreakdown['items'] = [];
    let subtotal = 0;

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemGuid);
      if (!menuItem) {
        return createError(`Menu item not found: ${item.menuItemGuid}`);
      }

      const basePrice = parseFloat(menuItem.price || '0');
      let modifierPrice = 0;
      const modifierDetails: OrderTotalBreakdown['items'][0]['modifierDetails'] = [];

      // Calculate modifier prices
      for (const [groupGuid, optionGuids] of Object.entries(item.selectedModifiers)) {
        const groupOptions: OrderTotalBreakdown['items'][0]['modifierDetails'][0]['options'] = [];
        
        for (const optionGuid of optionGuids) {
          const option = modifierOptionMap.get(optionGuid);
          if (!option) {
            return createError(`Modifier option not found: ${optionGuid}`);
          }
          
          const optionPrice = parseFloat(option.price);
          modifierPrice += optionPrice;
          
          groupOptions.push({
            optionId: optionGuid,
            optionName: option.name,
            optionPrice: optionPrice.toFixed(2),
          });
        }

        if (groupOptions.length > 0) {
          modifierDetails.push({
            groupId: groupGuid,
            groupName: '', // We don't have group name in the lookup, but it's stored for reference
            options: groupOptions,
          });
        }
      }

      const unitPrice = basePrice + modifierPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      calculatedItems.push({
        menuItemId: menuItem.id,
        menuItemGuid: item.menuItemGuid,
        itemName: menuItem.name,
        itemDescription: menuItem.description || '',
        basePrice: Math.round(basePrice * 100) / 100,
        modifierPrice: Math.round(modifierPrice * 100) / 100,
        unitPrice: Math.round(unitPrice * 100) / 100,
        quantity: item.quantity,
        totalPrice: Math.round(totalPrice * 100) / 100,
        modifierDetails,
      });
    }

    // Round subtotal
    subtotal = Math.round(subtotal * 100) / 100;

    // 7. Get discount from session
    const discountResult = await getActiveDiscount();
    let discountPercentage = 0;
    if (discountResult.ok && discountResult.data) {
      discountPercentage = discountResult.data.discountPercent;
    }
    const discount = Math.round((subtotal * discountPercentage / 100) * 100) / 100;

    // 8. Calculate service fee (on original subtotal, before discount)
    const serviceFee = Math.round((subtotal * serviceFeePercent / 100) * 100) / 100;

    // 9. Calculate tip (on original subtotal, before discount and fees)
    const subtotalAfterDiscount = subtotal - discount;
    let tip = 0;
    if (tipOption.type === 'percentage') {
      tip = Math.round((subtotal * tipOption.value / 100) * 100) / 100;
    } else {
      tip = Math.round(tipOption.value * 100) / 100;
    }

    // 10. Calculate total
    const total = Math.round((subtotalAfterDiscount + serviceFee + deliveryFee + tip) * 100) / 100;

    return createSuccess({
      items: calculatedItems,
      subtotal,
      serviceFee,
      deliveryFee,
      discount,
      discountPercentage,
      tip,
      total,
      restaurantId: restaurant.id,
      hotelId: restaurant.hotelId,
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
