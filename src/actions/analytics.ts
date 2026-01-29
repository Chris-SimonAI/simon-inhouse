'use server';

import 'server-only';

import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInRestaurants, guestProfiles } from '@/db/schemas';
import { eq, sql, gte, lte, and, count, desc } from 'drizzle-orm';

export interface AnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  uniqueGuests: number;
}

export interface OrdersTimeSeries {
  date: string;
  orders: number;
  revenue: number;
}

export interface TopRestaurant {
  restaurantId: number;
  restaurantName: string;
  orderCount: number;
  revenue: number;
}

export interface TopMenuItem {
  itemName: string;
  quantity: number;
  revenue: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
}

/**
 * Get analytics summary metrics.
 */
export async function getAnalyticsSummary(options?: {
  startDate?: Date;
  endDate?: Date;
  hotelId?: number;
}): Promise<AnalyticsSummary> {
  const { startDate, endDate, hotelId } = options || {};

  const conditions = [];
  if (startDate) {
    conditions.push(gte(dineInOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(dineInOrders.createdAt, endDate));
  }
  if (hotelId) {
    conditions.push(eq(dineInOrders.hotelId, hotelId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [orderStats] = await db
    .select({
      totalOrders: count(),
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${dineInOrders.totalAmount} AS DECIMAL)), 0)`,
    })
    .from(dineInOrders)
    .where(whereClause);

  // Count unique guests by phone in order metadata
  const orders = await db
    .select({ metadata: dineInOrders.metadata })
    .from(dineInOrders)
    .where(whereClause);

  const uniquePhones = new Set<string>();
  orders.forEach((order) => {
    const meta = order.metadata as Record<string, unknown> | null;
    if (meta?.phoneNumber) {
      uniquePhones.add(meta.phoneNumber as string);
    }
  });

  const totalOrders = orderStats.totalOrders || 0;
  const totalRevenue = Number(orderStats.totalRevenue) || 0;

  return {
    totalOrders,
    totalRevenue,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    uniqueGuests: uniquePhones.size,
  };
}

/**
 * Get orders time series data for charts.
 */
export async function getOrdersTimeSeries(options: {
  startDate: Date;
  endDate: Date;
  granularity?: 'day' | 'week' | 'month';
}): Promise<OrdersTimeSeries[]> {
  const { startDate, endDate, granularity = 'day' } = options;

  const dateFormat = granularity === 'month'
    ? 'YYYY-MM'
    : granularity === 'week'
    ? 'IYYY-IW'
    : 'YYYY-MM-DD';

  const result = await db
    .select({
      date: sql<string>`TO_CHAR(${dineInOrders.createdAt}, ${dateFormat})`,
      orders: count(),
      revenue: sql<number>`COALESCE(SUM(CAST(${dineInOrders.totalAmount} AS DECIMAL)), 0)`,
    })
    .from(dineInOrders)
    .where(and(
      gte(dineInOrders.createdAt, startDate),
      lte(dineInOrders.createdAt, endDate)
    ))
    .groupBy(sql`TO_CHAR(${dineInOrders.createdAt}, ${dateFormat})`)
    .orderBy(sql`TO_CHAR(${dineInOrders.createdAt}, ${dateFormat})`);

  return result.map(r => ({
    date: r.date,
    orders: r.orders,
    revenue: Number(r.revenue),
  }));
}

/**
 * Get orders grouped by status.
 */
export async function getOrdersByStatus(options?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<OrdersByStatus[]> {
  const { startDate, endDate } = options || {};

  const conditions = [];
  if (startDate) {
    conditions.push(gte(dineInOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(dineInOrders.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      status: dineInOrders.orderStatus,
      count: count(),
    })
    .from(dineInOrders)
    .where(whereClause)
    .groupBy(dineInOrders.orderStatus);

  return result.map(r => ({
    status: r.status,
    count: r.count,
  }));
}

/**
 * Get top restaurants by order count.
 */
export async function getTopRestaurants(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<TopRestaurant[]> {
  const { startDate, endDate, limit = 10 } = options || {};

  const conditions = [];
  if (startDate) {
    conditions.push(gte(dineInOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(dineInOrders.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      restaurantId: dineInOrders.restaurantId,
      restaurantName: dineInRestaurants.name,
      orderCount: count(),
      revenue: sql<number>`COALESCE(SUM(CAST(${dineInOrders.totalAmount} AS DECIMAL)), 0)`,
    })
    .from(dineInOrders)
    .leftJoin(dineInRestaurants, eq(dineInOrders.restaurantId, dineInRestaurants.id))
    .where(whereClause)
    .groupBy(dineInOrders.restaurantId, dineInRestaurants.name)
    .orderBy(desc(count()))
    .limit(limit);

  return result.map(r => ({
    restaurantId: r.restaurantId,
    restaurantName: r.restaurantName || 'Unknown',
    orderCount: r.orderCount,
    revenue: Number(r.revenue),
  }));
}

/**
 * Get top menu items by quantity ordered.
 */
export async function getTopMenuItems(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<TopMenuItem[]> {
  const { startDate, endDate, limit = 10 } = options || {};

  const conditions = [];
  if (startDate) {
    conditions.push(gte(dineInOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(dineInOrders.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Join order items with orders to filter by date
  const result = await db
    .select({
      itemName: dineInOrderItems.itemName,
      quantity: sql<number>`SUM(${dineInOrderItems.quantity})`,
      revenue: sql<number>`COALESCE(SUM(CAST(${dineInOrderItems.totalPrice} AS DECIMAL)), 0)`,
    })
    .from(dineInOrderItems)
    .innerJoin(dineInOrders, eq(dineInOrderItems.orderId, dineInOrders.id))
    .where(whereClause)
    .groupBy(dineInOrderItems.itemName)
    .orderBy(desc(sql`SUM(${dineInOrderItems.quantity})`))
    .limit(limit);

  return result.map(r => ({
    itemName: r.itemName,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
  }));
}

/**
 * Get guest metrics (new vs returning, etc.)
 */
export async function getGuestMetrics(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const { startDate, endDate } = options || {};

  // Get total guests
  const [totalGuests] = await db
    .select({ count: count() })
    .from(guestProfiles);

  // Get guests with orders in period
  const conditions = [];
  if (startDate) {
    conditions.push(gte(dineInOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(dineInOrders.createdAt, endDate));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orders = await db
    .select({ metadata: dineInOrders.metadata })
    .from(dineInOrders)
    .where(whereClause);

  // Count orders per guest
  const ordersByGuest = new Map<string, number>();
  orders.forEach((order) => {
    const meta = order.metadata as Record<string, unknown> | null;
    if (meta?.phoneNumber) {
      const phone = meta.phoneNumber as string;
      ordersByGuest.set(phone, (ordersByGuest.get(phone) || 0) + 1);
    }
  });

  let newGuests = 0;
  let returningGuests = 0;
  const frequencyDistribution: { orderCount: string; guests: number }[] = [];
  const freqMap = new Map<number, number>();

  ordersByGuest.forEach((count) => {
    if (count === 1) {
      newGuests++;
    } else {
      returningGuests++;
    }
    freqMap.set(count, (freqMap.get(count) || 0) + 1);
  });

  // Build frequency distribution
  const maxOrders = Math.min(Math.max(...Array.from(freqMap.keys()), 0), 10);
  for (let i = 1; i <= maxOrders; i++) {
    frequencyDistribution.push({
      orderCount: i === 10 ? '10+' : String(i),
      guests: freqMap.get(i) || 0,
    });
  }

  return {
    totalGuests: totalGuests.count,
    activeInPeriod: ordersByGuest.size,
    newGuests,
    returningGuests,
    frequencyDistribution,
  };
}
