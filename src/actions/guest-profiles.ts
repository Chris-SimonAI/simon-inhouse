'use server';

import 'server-only';

import { db } from '@/db';
import { guestProfiles, dineInOrders, dineInOrderItems, dineInRestaurants } from '@/db/schemas';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Find a guest profile by phone, or create one with optional defaults.
 */
export async function getOrCreateGuestProfile(
  phone: string,
  defaults?: {
    name?: string;
    email?: string;
    hotelId?: number;
    roomNumber?: string;
  }
) {
  const existing = await db
    .select()
    .from(guestProfiles)
    .where(eq(guestProfiles.phone, phone))
    .limit(1);

  if (existing.length > 0) {
    // Update hotelId / roomNumber if provided and different
    if (defaults?.hotelId || defaults?.roomNumber) {
      const updates: Record<string, unknown> = {};
      if (defaults.hotelId) updates.hotelId = defaults.hotelId;
      if (defaults.roomNumber) updates.roomNumber = defaults.roomNumber;
      if (defaults.name && !existing[0].name) updates.name = defaults.name;
      if (defaults.email && !existing[0].email) updates.email = defaults.email;

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db
          .update(guestProfiles)
          .set(updates)
          .where(eq(guestProfiles.phone, phone));

        const [updated] = await db
          .select()
          .from(guestProfiles)
          .where(eq(guestProfiles.phone, phone))
          .limit(1);
        return updated;
      }
    }
    return existing[0];
  }

  const [created] = await db
    .insert(guestProfiles)
    .values({
      phone,
      name: defaults?.name,
      email: defaults?.email,
      hotelId: defaults?.hotelId,
      roomNumber: defaults?.roomNumber,
    })
    .returning();

  return created;
}

/**
 * Update guest preferences learned from conversation.
 */
export async function updateGuestPreferences(
  phone: string,
  updates: {
    allergies?: string[];
    dietaryPreferences?: string[];
    favoriteCuisines?: string[];
    dislikedFoods?: string[];
    notes?: string;
    roomNumber?: string;
    name?: string;
  }
) {
  const profile = await db
    .select()
    .from(guestProfiles)
    .where(eq(guestProfiles.phone, phone))
    .limit(1);

  if (profile.length === 0) return null;

  const existing = profile[0];
  const merged: Record<string, unknown> = { updatedAt: new Date() };

  // Merge arrays (add new values, don't replace)
  if (updates.allergies) {
    const current = existing.allergies || [];
    merged.allergies = [...new Set([...current, ...updates.allergies])];
  }
  if (updates.dietaryPreferences) {
    const current = existing.dietaryPreferences || [];
    merged.dietaryPreferences = [...new Set([...current, ...updates.dietaryPreferences])];
  }
  if (updates.favoriteCuisines) {
    const current = existing.favoriteCuisines || [];
    merged.favoriteCuisines = [...new Set([...current, ...updates.favoriteCuisines])];
  }
  if (updates.dislikedFoods) {
    const current = existing.dislikedFoods || [];
    merged.dislikedFoods = [...new Set([...current, ...updates.dislikedFoods])];
  }
  if (updates.notes) {
    merged.notes = existing.notes
      ? `${existing.notes}\n${updates.notes}`
      : updates.notes;
  }
  if (updates.roomNumber) merged.roomNumber = updates.roomNumber;
  if (updates.name) merged.name = updates.name;

  await db
    .update(guestProfiles)
    .set(merged)
    .where(eq(guestProfiles.phone, phone));

  const [updated] = await db
    .select()
    .from(guestProfiles)
    .where(eq(guestProfiles.phone, phone))
    .limit(1);

  return updated;
}

/**
 * Get a guest's recent order history.
 */
export async function getGuestOrderHistory(phone: string, limit = 10) {
  // Find orders where metadata contains this phone number
  const orders = await db
    .select({
      id: dineInOrders.id,
      hotelId: dineInOrders.hotelId,
      restaurantId: dineInOrders.restaurantId,
      roomNumber: dineInOrders.roomNumber,
      totalAmount: dineInOrders.totalAmount,
      orderStatus: dineInOrders.orderStatus,
      metadata: dineInOrders.metadata,
      createdAt: dineInOrders.createdAt,
      restaurantName: dineInRestaurants.name,
    })
    .from(dineInOrders)
    .leftJoin(dineInRestaurants, eq(dineInOrders.restaurantId, dineInRestaurants.id))
    .orderBy(desc(dineInOrders.createdAt))
    .limit(limit * 3); // Fetch more to filter by phone

  // Filter client-side by phone in metadata
  const phoneOrders = orders.filter((o) => {
    const meta = o.metadata as Record<string, unknown> | null;
    return meta?.phoneNumber === phone;
  }).slice(0, limit);

  // Get items for each order
  const ordersWithItems = await Promise.all(
    phoneOrders.map(async (order) => {
      const items = await db
        .select({
          itemName: dineInOrderItems.itemName,
          quantity: dineInOrderItems.quantity,
          totalPrice: dineInOrderItems.totalPrice,
        })
        .from(dineInOrderItems)
        .where(eq(dineInOrderItems.orderId, order.id));

      return { ...order, items };
    })
  );

  return ordersWithItems;
}

/**
 * Set the persistent SMS thread ID for a guest.
 */
export async function setGuestSmsThreadId(phone: string, threadId: string) {
  await db
    .update(guestProfiles)
    .set({ smsThreadId: threadId, updatedAt: new Date() })
    .where(eq(guestProfiles.phone, phone));
}

/**
 * Mark a guest as having been introduced via SMS.
 */
export async function markGuestIntroduced(phone: string) {
  await db
    .update(guestProfiles)
    .set({ hasBeenIntroduced: true, updatedAt: new Date() })
    .where(eq(guestProfiles.phone, phone));
}

/**
 * Get or create a thread ID for a guest's SMS conversation.
 */
export async function getOrCreateSmsThreadId(phone: string): Promise<string> {
  const profile = await db
    .select({ smsThreadId: guestProfiles.smsThreadId })
    .from(guestProfiles)
    .where(eq(guestProfiles.phone, phone))
    .limit(1);

  if (profile.length > 0 && profile[0].smsThreadId) {
    return profile[0].smsThreadId;
  }

  const threadId = uuidv4();
  await setGuestSmsThreadId(phone, threadId);
  return threadId;
}
