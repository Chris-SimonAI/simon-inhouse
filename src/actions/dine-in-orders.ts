'use server';

import 'server-only';
import { db } from '@/db';
import {
  dineInOrders,
  dineInOrderItems,
  dineInPayments
} from '@/db/schemas';
import { eq, desc } from 'drizzle-orm';
import {
  CreateOrderRequestSchema,
  UpdateOrderStatusRequestSchema,
  CreatePaymentRequestSchema,
  UpdatePaymentStatusRequestSchema,
  ModifierDetails
} from '@/validations/dine-in-orders';
import { createSuccess, createError } from '@/lib/utils';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';

export async function createDineInOrder(input: unknown) {
  try {
    const validatedInput = CreateOrderRequestSchema.parse(input);

    const restaurantResult = await getRestaurantIdByGuid(validatedInput.restaurantId);
    if (!restaurantResult.ok) {
      return createError('Restaurant not found');
    }

    const totalAmount = validatedInput.items.reduce((sum, item) => {
      return sum + (parseFloat(item.unitPrice) * item.quantity);
    }, 0);

    const orderResult = await db.insert(dineInOrders).values({
      hotelId: validatedInput.hotelId,
      restaurantId: restaurantResult.data,
      userId: validatedInput.userId,
      roomNumber: validatedInput.roomNumber,
      specialInstructions: validatedInput.specialInstructions || null,
      totalAmount: totalAmount.toFixed(2),
      orderStatus: 'pending',
      metadata: '{}',
    }).returning();

    const order = orderResult[0];

    const orderItems = await Promise.all(
      validatedInput.items.map(async (item) => {
        const modifierDetails: ModifierDetails = item.modifierDetails || [];
        
        return db.insert(dineInOrderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          menuItemGuid: item.menuItemGuid,
          itemName: item.itemName,
          itemDescription: item.itemDescription || null,
          basePrice: parseFloat(item.basePrice).toFixed(2),
          modifierPrice: parseFloat(item.modifierPrice).toFixed(2),
          unitPrice: parseFloat(item.unitPrice).toFixed(2),
          quantity: item.quantity,
          totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
          modifierDetails: modifierDetails as ModifierDetails,
          metadata: '{}',
        }).returning();
      })
    );

    revalidateTag('orders');
    
    return createSuccess({
      order: order,
      orderItems: orderItems.flat(),
    });
  } catch (error) {
    console.error('Order creation error:', error);
    if (error instanceof z.ZodError) {
      return createError('Validation failed', error.errors);
    }
    return createError('Failed to create order');
  }
}

// Update order status
export async function updateOrderStatus(input: unknown) {
  try {
    const validatedInput = UpdateOrderStatusRequestSchema.parse(input);

    const result = await db
      .update(dineInOrders)
      .set({
        orderStatus: validatedInput.status,
        updatedAt: new Date(),
      })
      .where(eq(dineInOrders.id, validatedInput.orderId))
      .returning();

    if (result.length === 0) {
      return createError('Order not found');
    }

    // Revalidate orders cache
    revalidateTag('orders');

    return createSuccess(result[0]);
  } catch (error) {
    console.error('Order status update error:', error);
    if (error instanceof z.ZodError) {
      return createError('Validation failed', error.errors);
    }
    return createError('Failed to update order status');
  }
}

export async function getOrderById(orderId: number) {
  try {
    const order = await db
      .select()
      .from(dineInOrders)
      .where(eq(dineInOrders.id, orderId))
      .limit(1);

    if (order.length === 0) {
      return createError('Order not found');
    }

    return createSuccess(order[0]);
  } catch (error) {
    console.error('Get order error:', error);
    return createError('Failed to get order');
  }
}

export async function getOrdersByUserId(userId: number) {
  try {
    const orders = await db
      .select()
      .from(dineInOrders)
      .where(eq(dineInOrders.userId, userId))
      .orderBy(desc(dineInOrders.createdAt));

    return createSuccess(orders);
  } catch (error) {
    console.error('Get orders by user error:', error);
    return createError('Failed to get orders');
  }
}

export async function getRestaurantIdByGuid(restaurantId: number) {
  try {
    return createSuccess(restaurantId);
  } catch (error) {
    console.error('Get restaurant ID error:', error);
    return createError('Failed to get restaurant ID');
  }
}

// Create payment record
export async function createPayment(input: unknown) {
  try {
    const validatedInput = CreatePaymentRequestSchema.parse(input);

    const payment = await db.insert(dineInPayments).values({
      orderId: validatedInput.orderId,
      stripePaymentIntentId: 'temp_' + Date.now(), // Temporary ID
      amount: validatedInput.amount.toFixed(2),
      currency: validatedInput.currency,
      paymentStatus: 'pending',
      stripeMetadata: '{}',
      metadata: '{}',
    }).returning();

    return createSuccess(payment[0]);
  } catch (error) {
    console.error('Payment creation error:', error);
    if (error instanceof z.ZodError) {
      return createError('Validation failed', error.errors);
    }
    return createError('Failed to create payment');
  }
}

export async function updatePaymentStatus(input: unknown) {
  try {
    const validatedInput = UpdatePaymentStatusRequestSchema.parse(input);

    const result = await db
      .update(dineInPayments)
      .set({
        paymentStatus: validatedInput.status,
        updatedAt: new Date(),
      })
      .where(eq(dineInPayments.id, validatedInput.paymentId))
      .returning();

    if (result.length === 0) {
      return createError('Payment not found');
    }

    return createSuccess(result[0]);
  } catch (error) {
    console.error('Payment status update error:', error);
    if (error instanceof z.ZodError) {
      return createError('Validation failed', error.errors);
    }
    return createError('Failed to update payment status');
  }
}
