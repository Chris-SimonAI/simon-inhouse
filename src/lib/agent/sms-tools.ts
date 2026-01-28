import "server-only";

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getCompleteMenuByRestaurant } from "@/actions/menu";
import { getOrCreateGuestProfile, updateGuestPreferences, getGuestOrderHistory } from "@/actions/guest-profiles";
import { createSmsCheckoutSession } from "@/actions/sms-payments";
import { db } from "@/db";
import { dineInRestaurants } from "@/db/schemas";
import { eq, and } from "drizzle-orm";

const createErrorResponse = (error: string, message: string) =>
  JSON.stringify({ error, message });

const createSuccessResponse = (data: unknown, message?: string) =>
  JSON.stringify({ data, ...(message && { message }) });

export const searchMenuTool = new DynamicStructuredTool({
  name: "search_menu",
  description:
    "Search menu items at a restaurant for the guest's hotel. Returns menu groups with items, prices, descriptions, and allergens. Use the query to filter results.",
  schema: z.object({
    hotelId: z.number().describe("Hotel ID"),
    query: z.string().optional().describe("Search query (e.g., 'pasta', 'vegetarian', 'dessert')"),
    restaurantId: z.number().optional().describe("Specific restaurant ID to search"),
  }),
  func: async ({ hotelId, query, restaurantId }) => {
    try {
      if (restaurantId) {
        const result = await getCompleteMenuByRestaurant({ id: restaurantId });
        if (!result.ok) {
          return createErrorResponse("MENU_FETCH_FAILED", result.message || "Failed to fetch menu");
        }

        const menuData = result.data;
        // Filter by query if provided
        if (query) {
          const q = query.toLowerCase();
          const filteredGroups = menuData.groups
            .map((group) => ({
              ...group,
              items: group.items.filter(
                (item) =>
                  item.name.toLowerCase().includes(q) ||
                  item.description.toLowerCase().includes(q) ||
                  group.name.toLowerCase().includes(q)
              ),
            }))
            .filter((group) => group.items.length > 0);

          return createSuccessResponse({
            restaurantName: menuData.restaurantName,
            restaurantId: menuData.restaurantId,
            groups: filteredGroups,
          });
        }

        return createSuccessResponse(menuData);
      }

      // Search all restaurants for this hotel (direct query, no session needed)
      const restaurantList = await db
        .select()
        .from(dineInRestaurants)
        .where(
          and(
            eq(dineInRestaurants.hotelId, hotelId),
            eq(dineInRestaurants.status, "approved")
          )
        );
      if (restaurantList.length === 0) {
        return createErrorResponse("NO_RESTAURANTS", "No restaurants found for this hotel");
      }

      const results: Array<{
        restaurantName: string;
        restaurantId: number;
        matchingItems: Array<{
          name: string;
          description: string;
          price: number;
          allergens: string[];
          groupName: string;
        }>;
      }> = [];

      for (const restaurant of restaurantList) {
        const menu = await getCompleteMenuByRestaurant({ id: restaurant.id });
        if (!menu.ok || !menu.data) continue;

        const q = (query || "").toLowerCase();
        const matchingItems: typeof results[0]["matchingItems"] = [];

        for (const group of menu.data.groups) {
          for (const item of group.items) {
            if (
              !q ||
              item.name.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              group.name.toLowerCase().includes(q)
            ) {
              matchingItems.push({
                name: item.name,
                description: item.description,
                price: item.price,
                allergens: item.allergens,
                groupName: group.name,
              });
            }
          }
        }

        if (matchingItems.length > 0) {
          results.push({
            restaurantName: menu.data.restaurantName,
            restaurantId: menu.data.restaurantId,
            matchingItems: matchingItems.slice(0, 10), // Limit per restaurant
          });
        }
      }

      if (results.length === 0) {
        return createErrorResponse("NO_RESULTS", `No menu items found matching "${query || "all"}"`);
      }

      return createSuccessResponse(results);
    } catch (err) {
      console.error("Error in search_menu tool:", err);
      return createErrorResponse(
        "MENU_SEARCH_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const getGuestProfileTool = new DynamicStructuredTool({
  name: "get_guest_profile",
  description:
    "Load the guest's profile including preferences, allergies, and recent order history.",
  schema: z.object({
    phone: z.string().describe("Guest phone number in E.164 format"),
  }),
  func: async ({ phone }) => {
    try {
      const profile = await getOrCreateGuestProfile(phone);
      const orders = await getGuestOrderHistory(phone, 5);
      return createSuccessResponse({ profile, recentOrders: orders });
    } catch (err) {
      return createErrorResponse(
        "PROFILE_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const updatePreferencesTool = new DynamicStructuredTool({
  name: "update_preferences",
  description:
    "Save guest preferences learned during conversation (allergies, dietary preferences, favorite cuisines, dislikes, or notes).",
  schema: z.object({
    phone: z.string().describe("Guest phone number in E.164 format"),
    allergies: z.array(z.string()).optional().describe("New allergies to add"),
    dietaryPreferences: z.array(z.string()).optional().describe("Dietary preferences to add"),
    favoriteCuisines: z.array(z.string()).optional().describe("Favorite cuisine types to add"),
    dislikedFoods: z.array(z.string()).optional().describe("Foods the guest dislikes"),
    notes: z.string().optional().describe("Freeform notes from the conversation"),
    roomNumber: z.string().optional().describe("Guest's room number"),
    name: z.string().optional().describe("Guest's name"),
  }),
  func: async ({ phone, ...updates }) => {
    try {
      const updated = await updateGuestPreferences(phone, updates);
      if (!updated) {
        return createErrorResponse("PROFILE_NOT_FOUND", "Guest profile not found");
      }
      return createSuccessResponse(updated, "Preferences updated");
    } catch (err) {
      return createErrorResponse(
        "UPDATE_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const listRestaurantsTool = new DynamicStructuredTool({
  name: "list_restaurants",
  description:
    "List all available restaurants at the guest's hotel.",
  schema: z.object({
    hotelId: z.number().describe("Hotel ID"),
  }),
  func: async ({ hotelId }) => {
    try {
      const restaurantList = await db
        .select()
        .from(dineInRestaurants)
        .where(
          and(
            eq(dineInRestaurants.hotelId, hotelId),
            eq(dineInRestaurants.status, "approved")
          )
        );
      if (restaurantList.length === 0) {
        return createErrorResponse("NO_RESTAURANTS", "No restaurants found");
      }
      const restaurants = restaurantList.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        cuisine: r.cuisine,
        deliveryFee: r.deliveryFee,
      }));
      return createSuccessResponse(restaurants);
    } catch (err) {
      return createErrorResponse(
        "RESTAURANTS_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const getOrderStatusTool = new DynamicStructuredTool({
  name: "get_order_status",
  description:
    "Check the guest's most recent order status.",
  schema: z.object({
    phone: z.string().describe("Guest phone number in E.164 format"),
  }),
  func: async ({ phone }) => {
    try {
      const orders = await getGuestOrderHistory(phone, 1);
      if (orders.length === 0) {
        return createSuccessResponse(null, "No recent orders found");
      }
      const order = orders[0];
      return createSuccessResponse({
        orderId: order.id,
        status: order.orderStatus,
        restaurant: order.restaurantName,
        total: order.totalAmount,
        items: order.items,
        orderedAt: order.createdAt,
      });
    } catch (err) {
      return createErrorResponse(
        "ORDER_STATUS_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const placeOrderTool = new DynamicStructuredTool({
  name: "place_order",
  description:
    "Place a food order and generate a payment link for the guest. Returns a checkout URL the guest must open to pay. ALWAYS confirm the order details with the guest before calling this.",
  schema: z.object({
    phone: z.string().describe("Guest phone number in E.164 format"),
    hotelId: z.number().describe("Hotel ID"),
    restaurantId: z.number().describe("Restaurant ID"),
    roomNumber: z.string().describe("Guest's room number"),
    items: z
      .array(
        z.object({
          menuItemGuid: z.string().describe("Menu item GUID"),
          name: z.string().describe("Item name for display"),
          quantity: z.number().min(1).describe("Quantity"),
          selectedModifiers: z
            .record(z.string(), z.array(z.string()))
            .optional()
            .describe("Selected modifier option GUIDs grouped by modifier group GUID"),
        })
      )
      .describe("Items to order"),
    specialInstructions: z.string().optional().describe("Special instructions for the order"),
  }),
  func: async ({ phone, hotelId, restaurantId, roomNumber, items, specialInstructions }) => {
    try {
      const profile = await getOrCreateGuestProfile(phone);
      const result = await createSmsCheckoutSession({
        phone,
        name: profile.name || "Guest",
        hotelId,
        restaurantId,
        roomNumber,
        items,
        specialInstructions,
      });

      if (!result.ok) {
        return createErrorResponse("ORDER_FAILED", result.message || "Failed to create order");
      }

      const { orderId, checkoutUrl, total, items: orderItems } = result.data;
      const itemSummary = orderItems
        .map((i) => `${i.quantity}x ${i.name}`)
        .join(", ");

      return createSuccessResponse(
        { orderId, checkoutUrl, total, items: orderItems },
        `Order created: ${itemSummary}. Total: $${total}. Payment link: ${checkoutUrl}`
      );
    } catch (err) {
      return createErrorResponse(
        "ORDER_ERROR",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});

export const smsAgentTools = [
  searchMenuTool,
  getGuestProfileTool,
  updatePreferencesTool,
  listRestaurantsTool,
  getOrderStatusTool,
  placeOrderTool,
];
