'use server';

import 'server-only';

import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInRestaurants, hotels } from '@/db/schemas';
import { eq, count } from 'drizzle-orm';
import { createSuccess, createError } from '@/lib/utils';

export type FulfillmentStatus = 'pending' | 'processing' | 'ready' | 'delivered' | 'cancelled';

export interface FulfillmentEvent {
  orderId: number;
  status: FulfillmentStatus;
  timestamp: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get order details for fulfillment
 */
export async function getOrderForFulfillment(orderId: number) {
  try {
    const order = await db.select({
      id: dineInOrders.id,
      hotelId: dineInOrders.hotelId,
      restaurantId: dineInOrders.restaurantId,
      roomNumber: dineInOrders.roomNumber,
      specialInstructions: dineInOrders.specialInstructions,
      totalAmount: dineInOrders.totalAmount,
      orderStatus: dineInOrders.orderStatus,
      createdAt: dineInOrders.createdAt,
      hotel: {
        name: hotels.name,
        address: hotels.address,
      },
      restaurant: {
        name: dineInRestaurants.name,
        phone: dineInRestaurants.phoneNumber,
      }
    })
    .from(dineInOrders)
    .leftJoin(hotels, eq(dineInOrders.hotelId, hotels.id))
    .leftJoin(dineInRestaurants, eq(dineInOrders.restaurantId, dineInRestaurants.id))
    .where(eq(dineInOrders.id, orderId))
    .limit(1);

    if (order.length === 0) {
      return createError('Order not found');
    }

    // Get order items
    const orderItems = await db.select({
      id: dineInOrderItems.id,
      itemName: dineInOrderItems.itemName,
      itemDescription: dineInOrderItems.itemDescription,
      quantity: dineInOrderItems.quantity,
      unitPrice: dineInOrderItems.unitPrice,
      totalPrice: dineInOrderItems.totalPrice,
      modifierDetails: dineInOrderItems.modifierDetails,
    })
    .from(dineInOrderItems)
    .where(eq(dineInOrderItems.orderId, orderId));

    return createSuccess({
      ...order[0],
      items: orderItems
    });
  } catch (error) {
    console.error('Error getting order for fulfillment:', error);
    return createError('Failed to get order details');
  }
}

/**
 * Update order fulfillment status
 */
export async function updateFulfillmentStatus(input: {
  orderId: number;
  status: FulfillmentStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { orderId, status, notes, metadata } = input;

    // Update order status
    const updatedOrder = await db.update(dineInOrders)
      .set({ 
        orderStatus: status === 'delivered' ? 'delivered' : 'confirmed',
        updatedAt: new Date(),
        metadata: {
          ...metadata,
          fulfillmentStatus: status,
          fulfillmentNotes: notes,
          lastFulfillmentUpdate: new Date().toISOString(),
        } as Record<string, unknown>
      })
      .where(eq(dineInOrders.id, orderId))
      .returning();

    if (updatedOrder.length === 0) {
      return createError('Order not found or failed to update');
    }

    // Log fulfillment event
    console.log('Fulfillment status updated:', {
      orderId,
      status,
      notes,
      timestamp: new Date().toISOString()
    });

    return createSuccess(updatedOrder[0]);
  } catch (error) {
    console.error('Error updating fulfillment status:', error);
    return createError('Failed to update fulfillment status');
  }
}

/**
 * Mark order as ready for delivery
 */
export async function markOrderReady(orderId: number, notes?: string) {
  return updateFulfillmentStatus({
    orderId,
    status: 'ready',
    notes,
    metadata: {
      readyAt: new Date().toISOString()
    }
  });
}

/**
 * Mark order as delivered
 */
export async function markOrderDelivered(orderId: number, notes?: string) {
  return updateFulfillmentStatus({
    orderId,
    status: 'delivered',
    notes,
    metadata: {
      deliveredAt: new Date().toISOString()
    }
  });
}

/**
 * Cancel order fulfillment
 */
export async function cancelOrderFulfillment(orderId: number, reason: string) {
  return updateFulfillmentStatus({
    orderId,
    status: 'cancelled',
    notes: reason,
    metadata: {
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    }
  });
}

/**
 * Get orders by fulfillment status
 */
export async function getOrdersByFulfillmentStatus(status: FulfillmentStatus) {
  try {
    const orders = await db.select({
      id: dineInOrders.id,
      hotelId: dineInOrders.hotelId,
      restaurantId: dineInOrders.restaurantId,
      roomNumber: dineInOrders.roomNumber,
      totalAmount: dineInOrders.totalAmount,
      orderStatus: dineInOrders.orderStatus,
      createdAt: dineInOrders.createdAt,
      hotel: {
        name: hotels.name,
      },
      restaurant: {
        name: dineInRestaurants.name,
      }
    })
    .from(dineInOrders)
    .leftJoin(hotels, eq(dineInOrders.hotelId, hotels.id))
    .leftJoin(dineInRestaurants, eq(dineInOrders.restaurantId, dineInRestaurants.id))
    .where(eq(dineInOrders.orderStatus, status === 'delivered' ? 'delivered' : 'confirmed'))
    .orderBy(dineInOrders.createdAt);

    return createSuccess(orders);
  } catch (error) {
    console.error('Error getting orders by fulfillment status:', error);
    return createError('Failed to get orders');
  }
}

/**
 * Get fulfillment statistics
 */
export async function getFulfillmentStats() {
  try {
    const stats = await db.select({
      status: dineInOrders.orderStatus,
      count: count()
    })
    .from(dineInOrders)
    .groupBy(dineInOrders.orderStatus);

    return createSuccess(stats);
  } catch (error) {
    console.error('Error getting fulfillment stats:', error);
    return createError('Failed to get fulfillment statistics');
  }
}

/**
 * Process order fulfillment (stub for future implementation)
 */
export async function processOrderFulfillment(orderId: number) {
  try {
    console.log('Processing order fulfillment for order:', orderId);
    
    // Get order details
    const orderResult = await getOrderForFulfillment(orderId);
    if (!orderResult.ok) {
      return orderResult;
    }

    const order = orderResult.data;
    
    // TODO: Implement actual fulfillment processes
    // 1. Send notification to restaurant kitchen
    // 2. Update inventory levels
    // 3. Send confirmation SMS/email to guest
    // 4. Log fulfillment event
    // 5. Update order tracking
    
    console.log('Order fulfillment processed:', {
      orderId,
      hotel: order.hotel?.name,
      restaurant: order.restaurant?.name,
      roomNumber: order.roomNumber,
      totalAmount: order.totalAmount,
      itemCount: order.items.length
    });

    // For now, just mark as processing
    return updateFulfillmentStatus({
      orderId,
      status: 'processing',
      notes: 'Order fulfillment initiated',
      metadata: {
        processedAt: new Date().toISOString(),
        fulfillmentType: 'automatic'
      }
    });
  } catch (error) {
    console.error('Error processing order fulfillment:', error);
    return createError('Failed to process order fulfillment');
  }
}
