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
import { getHotelBySlug } from '@/actions/hotels';
import { dineInRestaurants } from '@/db/schemas';
import { and, inArray } from 'drizzle-orm';

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

export async function getDineInOrdersForHotel(
  hotelSlug: string,
  status?: typeof dineInOrders.$inferSelect['orderStatus'],
) {
  try {
    const hotelResult = await getHotelBySlug(hotelSlug);
    if (!hotelResult.ok || !hotelResult.data) {
      return createError('Hotel not found');
    }

    const hotelId = hotelResult.data.id;

    // Fetch orders joined with restaurant name
    const whereClause = status
      ? and(eq(dineInOrders.hotelId, hotelId), eq(dineInOrders.orderStatus, status))
      : eq(dineInOrders.hotelId, hotelId);

    const orders = await db
      .select({
        id: dineInOrders.id,
        createdAt: dineInOrders.createdAt,
        orderStatus: dineInOrders.orderStatus,
        roomNumber: dineInOrders.roomNumber,
        totalAmount: dineInOrders.totalAmount,
        metadata: dineInOrders.metadata,
        restaurantName: dineInRestaurants.name,
      })
      .from(dineInOrders)
      .leftJoin(dineInRestaurants, eq(dineInOrders.restaurantId, dineInRestaurants.id))
      .where(whereClause)
      .orderBy(desc(dineInOrders.createdAt));

    if (orders.length === 0) {
      return createSuccess([] as Array<{
        id: number;
        createdAt: Date;
        orderStatus: typeof dineInOrders.$inferSelect['orderStatus'];
        roomNumber: string;
        totalAmount: string;
        restaurantName: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
        paymentStatus?: typeof dineInPayments.$inferSelect['paymentStatus'];
        errorReason?: string | null;
      }>);
    }

    // Collect order IDs to fetch latest payment per order
    const orderIds = orders.map((o) => o.id);

    // Fetch all payments for these orders, newest first, then pick latest per order in-memory
    const payments = await db
      .select({
        id: dineInPayments.id,
        orderId: dineInPayments.orderId,
        paymentStatus: dineInPayments.paymentStatus,
        stripeMetadata: dineInPayments.stripeMetadata,
        createdAt: dineInPayments.createdAt,
      })
      .from(dineInPayments)
      .where(inArray(dineInPayments.orderId, orderIds))
      .orderBy(desc(dineInPayments.createdAt), desc(dineInPayments.id));

    const latestPaymentByOrderId = new Map<number, {
      paymentStatus: typeof dineInPayments.$inferSelect['paymentStatus'];
      stripeMetadata: unknown;
    }>();
    for (const p of payments) {
      if (!latestPaymentByOrderId.has(p.orderId)) {
        latestPaymentByOrderId.set(p.orderId, {
          paymentStatus: p.paymentStatus,
          stripeMetadata: p.stripeMetadata as unknown,
        });
      }
    }

    // Fetch items for these orders and group in-memory
    const rawItems = await db
      .select({
        orderId: dineInOrderItems.orderId,
        itemName: dineInOrderItems.itemName,
        quantity: dineInOrderItems.quantity,
        unitPrice: dineInOrderItems.unitPrice,
        totalPrice: dineInOrderItems.totalPrice,
      })
      .from(dineInOrderItems)
      .where(inArray(dineInOrderItems.orderId, orderIds));

    const itemsByOrderId = new Map<number, Array<{
      itemName: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }>>();
    for (const it of rawItems) {
      const arr = itemsByOrderId.get(it.orderId) ?? [];
      arr.push({
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: String(it.unitPrice),
        totalPrice: String(it.totalPrice),
      });
      itemsByOrderId.set(it.orderId, arr);
    }

    const data = orders.map((o) => {
      const orderMetadata = (o.metadata as Record<string, unknown> | null) ?? null;
      const latest = latestPaymentByOrderId.get(o.id);

      return {
        id: o.id,
        createdAt: o.createdAt,
        orderStatus: o.orderStatus,
        roomNumber: o.roomNumber,
        totalAmount: o.totalAmount,
        trackingUrl: (orderMetadata?.['trackingUrl'] as string | undefined) ?? null,
        restaurantName: o.restaurantName ?? null,
        contactEmail: (orderMetadata?.['email'] as string | undefined) ?? null,
        contactPhone: (orderMetadata?.['phoneNumber'] as string | undefined) ?? null,
        paymentStatus: latest?.paymentStatus,
        errorReason: (orderMetadata?.['errorReason'] as string | undefined) ?? null,
        items: itemsByOrderId.get(o.id) ?? [],
      };
    });

    return createSuccess(data);
  } catch (error) {
    console.error('Get dine-in orders for hotel error:', error);
    return createError('Failed to get orders');
  }
}
