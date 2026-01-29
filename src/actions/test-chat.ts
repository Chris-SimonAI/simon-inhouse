'use server';

import 'server-only';

import { db } from '@/db';
import {
  guestProfiles,
  guestPreferences,
  chatConversations,
  hotels,
  dineInRestaurants,
  hotelRestaurants,
} from '@/db/schemas';
import type { GuestPreference, ChatMessage } from '@/db/schemas';
import { eq, and, desc, inArray, or } from 'drizzle-orm';
import { createSuccess, createError } from '@/lib/utils';
import { getCompleteMenuByRestaurant, type MenuData } from './menu';

// ============ Guest Preferences ============

/**
 * Get all preferences for a guest
 */
export async function getGuestPreferencesById(guestId: number) {
  try {
    const preferences = await db
      .select()
      .from(guestPreferences)
      .where(eq(guestPreferences.guestId, guestId))
      .orderBy(desc(guestPreferences.updatedAt));

    return createSuccess(preferences);
  } catch (error) {
    console.error('Error in getGuestPreferencesById:', error);
    return createError('Failed to fetch guest preferences');
  }
}

/**
 * Add or update a guest preference
 */
export async function upsertGuestPreference(input: {
  guestId: number;
  preferenceType: string;
  preferenceValue: string;
  confidence?: number;
  source?: 'stated' | 'inferred' | 'order_history';
}) {
  try {
    // Check if preference already exists
    const existing = await db
      .select()
      .from(guestPreferences)
      .where(
        and(
          eq(guestPreferences.guestId, input.guestId),
          eq(guestPreferences.preferenceType, input.preferenceType),
          eq(guestPreferences.preferenceValue, input.preferenceValue)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update confidence if higher
      const existingConfidence = parseFloat(existing[0].confidence);
      const newConfidence = input.confidence ?? 1.0;

      if (newConfidence > existingConfidence) {
        const [updated] = await db
          .update(guestPreferences)
          .set({
            confidence: newConfidence.toString(),
            source: input.source || existing[0].source,
            updatedAt: new Date(),
          })
          .where(eq(guestPreferences.id, existing[0].id))
          .returning();
        return createSuccess(updated);
      }
      return createSuccess(existing[0]);
    }

    // Insert new preference
    const [created] = await db
      .insert(guestPreferences)
      .values({
        guestId: input.guestId,
        preferenceType: input.preferenceType,
        preferenceValue: input.preferenceValue,
        confidence: (input.confidence ?? 1.0).toString(),
        source: input.source || 'stated',
      })
      .returning();

    return createSuccess(created);
  } catch (error) {
    console.error('Error in upsertGuestPreference:', error);
    return createError('Failed to save guest preference');
  }
}

/**
 * Bulk upsert multiple preferences (used after Claude extracts them)
 */
export async function bulkUpsertGuestPreferences(
  guestId: number,
  preferences: Array<{
    type: string;
    value: string;
    confidence: number;
    source?: 'stated' | 'inferred' | 'order_history';
  }>
) {
  try {
    const results: GuestPreference[] = [];

    for (const pref of preferences) {
      const result = await upsertGuestPreference({
        guestId,
        preferenceType: pref.type,
        preferenceValue: pref.value,
        confidence: pref.confidence,
        source: pref.source || 'inferred',
      });

      if (result.ok) {
        results.push(result.data);
      }
    }

    return createSuccess(results);
  } catch (error) {
    console.error('Error in bulkUpsertGuestPreferences:', error);
    return createError('Failed to save guest preferences');
  }
}

/**
 * Delete a guest preference
 */
export async function deleteGuestPreference(preferenceId: number) {
  try {
    const [deleted] = await db
      .delete(guestPreferences)
      .where(eq(guestPreferences.id, preferenceId))
      .returning();

    if (!deleted) {
      return createError('Preference not found');
    }

    return createSuccess(deleted);
  } catch (error) {
    console.error('Error in deleteGuestPreference:', error);
    return createError('Failed to delete guest preference');
  }
}

/**
 * Clear all preferences for a guest (for testing reset)
 */
export async function clearGuestPreferences(guestId: number) {
  try {
    await db
      .delete(guestPreferences)
      .where(eq(guestPreferences.guestId, guestId));

    return createSuccess({ cleared: true });
  } catch (error) {
    console.error('Error in clearGuestPreferences:', error);
    return createError('Failed to clear guest preferences');
  }
}

// ============ Chat Conversations ============

/**
 * Create a new conversation
 */
export async function createConversation(guestId: number, hotelId: number) {
  try {
    const [conversation] = await db
      .insert(chatConversations)
      .values({
        guestId,
        hotelId,
        messages: [],
      })
      .returning();

    return createSuccess(conversation);
  } catch (error) {
    console.error('Error in createConversation:', error);
    return createError('Failed to create conversation');
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversation(conversationId: number) {
  try {
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return createError('Conversation not found');
    }

    return createSuccess(conversation);
  } catch (error) {
    console.error('Error in getConversation:', error);
    return createError('Failed to fetch conversation');
  }
}

/**
 * Get all conversations for a guest
 */
export async function getGuestConversations(guestId: number, limit = 20) {
  try {
    const conversations = await db
      .select({
        id: chatConversations.id,
        guestId: chatConversations.guestId,
        hotelId: chatConversations.hotelId,
        hotelName: hotels.name,
        messages: chatConversations.messages,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
      })
      .from(chatConversations)
      .leftJoin(hotels, eq(chatConversations.hotelId, hotels.id))
      .where(eq(chatConversations.guestId, guestId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit);

    return createSuccess(conversations);
  } catch (error) {
    console.error('Error in getGuestConversations:', error);
    return createError('Failed to fetch conversations');
  }
}

/**
 * Add a message to a conversation
 */
export async function addMessageToConversation(
  conversationId: number,
  message: ChatMessage
) {
  try {
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return createError('Conversation not found');
    }

    const updatedMessages = [...(conversation.messages || []), message];

    const [updated] = await db
      .update(chatConversations)
      .set({
        messages: updatedMessages,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, conversationId))
      .returning();

    return createSuccess(updated);
  } catch (error) {
    console.error('Error in addMessageToConversation:', error);
    return createError('Failed to add message');
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: number) {
  try {
    const [deleted] = await db
      .delete(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .returning();

    if (!deleted) {
      return createError('Conversation not found');
    }

    return createSuccess(deleted);
  } catch (error) {
    console.error('Error in deleteConversation:', error);
    return createError('Failed to delete conversation');
  }
}

// ============ Test Guest Management ============

/**
 * Create a test guest profile for the test chat
 */
export async function createTestGuest(input: {
  name: string;
  email?: string;
  phone: string;
  hotelId: number;
  roomNumber?: string;
}) {
  try {
    // Check if phone already exists
    const existing = await db
      .select()
      .from(guestProfiles)
      .where(eq(guestProfiles.phone, input.phone))
      .limit(1);

    if (existing.length > 0) {
      // Update existing guest
      const [updated] = await db
        .update(guestProfiles)
        .set({
          name: input.name,
          email: input.email,
          hotelId: input.hotelId,
          roomNumber: input.roomNumber,
          updatedAt: new Date(),
        })
        .where(eq(guestProfiles.phone, input.phone))
        .returning();
      return createSuccess(updated);
    }

    const [created] = await db
      .insert(guestProfiles)
      .values({
        phone: input.phone,
        name: input.name,
        email: input.email,
        hotelId: input.hotelId,
        roomNumber: input.roomNumber,
      })
      .returning();

    return createSuccess(created);
  } catch (error) {
    console.error('Error in createTestGuest:', error);
    return createError('Failed to create test guest');
  }
}

/**
 * Reset a test guest's data (preferences, conversations)
 */
export async function resetTestGuestData(guestId: number) {
  try {
    // Clear preferences
    await db
      .delete(guestPreferences)
      .where(eq(guestPreferences.guestId, guestId));

    // Clear conversations
    await db
      .delete(chatConversations)
      .where(eq(chatConversations.guestId, guestId));

    // Reset profile fields
    await db
      .update(guestProfiles)
      .set({
        dietaryPreferences: [],
        allergies: [],
        favoriteCuisines: [],
        dislikedFoods: [],
        notes: null,
        hasBeenIntroduced: false,
        updatedAt: new Date(),
      })
      .where(eq(guestProfiles.id, guestId));

    return createSuccess({ reset: true });
  } catch (error) {
    console.error('Error in resetTestGuestData:', error);
    return createError('Failed to reset test guest data');
  }
}

// ============ Context for Claude ============

/**
 * Get restaurants available at a hotel location
 */
export async function getHotelRestaurants(hotelId: number) {
  try {
    // Get restaurant IDs linked via the hotel_restaurants junction table
    const linkedRows = await db
      .select({ restaurantId: hotelRestaurants.restaurantId })
      .from(hotelRestaurants)
      .where(
        and(
          eq(hotelRestaurants.hotelId, hotelId),
          eq(hotelRestaurants.isActive, true)
        )
      );
    const linkedIds = linkedRows.map((r) => r.restaurantId);

    // Fetch restaurants that are either directly assigned OR linked via junction table
    const restaurants = await db
      .select()
      .from(dineInRestaurants)
      .where(
        and(
          eq(dineInRestaurants.status, 'approved'),
          linkedIds.length > 0
            ? or(
                eq(dineInRestaurants.hotelId, hotelId),
                inArray(dineInRestaurants.id, linkedIds)
              )
            : eq(dineInRestaurants.hotelId, hotelId)
        )
      );

    return createSuccess(restaurants);
  } catch (error) {
    console.error('Error in getHotelRestaurants:', error);
    return createError('Failed to fetch hotel restaurants');
  }
}

/**
 * Get complete context for Claude including guest preferences, restaurants, and menus
 */
export async function getChatContext(guestId: number, hotelId: number) {
  try {
    // Get guest profile with preferences
    const [guestProfile] = await db
      .select()
      .from(guestProfiles)
      .where(eq(guestProfiles.id, guestId))
      .limit(1);

    if (!guestProfile) {
      return createError('Guest not found');
    }

    // Get detailed preferences from guest_preferences table
    const preferencesResult = await getGuestPreferencesById(guestId);
    const detailedPreferences = preferencesResult.ok ? preferencesResult.data : [];

    // Get hotel info
    const [hotel] = await db
      .select()
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);

    if (!hotel) {
      return createError('Hotel not found');
    }

    // Get restaurants for this hotel
    const restaurantsResult = await getHotelRestaurants(hotelId);
    if (!restaurantsResult.ok) {
      return createError('Failed to fetch restaurants');
    }

    // Get menus for each restaurant
    const restaurantsWithMenus: Array<{
      restaurant: typeof restaurantsResult.data[0];
      menu: MenuData | null;
    }> = [];

    for (const restaurant of restaurantsResult.data) {
      const menuResult = await getCompleteMenuByRestaurant({ id: restaurant.id });
      restaurantsWithMenus.push({
        restaurant,
        menu: menuResult.ok ? menuResult.data : null,
      });
    }

    return createSuccess({
      guest: {
        id: guestProfile.id,
        name: guestProfile.name,
        phone: guestProfile.phone,
        roomNumber: guestProfile.roomNumber,
        // Legacy preferences from profile
        allergies: guestProfile.allergies,
        dietaryPreferences: guestProfile.dietaryPreferences,
        favoriteCuisines: guestProfile.favoriteCuisines,
        dislikedFoods: guestProfile.dislikedFoods,
      },
      detailedPreferences,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        address: hotel.address,
      },
      restaurants: restaurantsWithMenus,
    });
  } catch (error) {
    console.error('Error in getChatContext:', error);
    return createError('Failed to fetch chat context');
  }
}
