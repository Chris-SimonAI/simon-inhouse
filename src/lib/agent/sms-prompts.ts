import "server-only";

import { SystemMessage } from "@langchain/core/messages";
import type { GuestProfile } from "@/db/schemas/guest-profiles";

interface OrderHistoryItem {
  restaurantName: string | null;
  items: { itemName: string; quantity: number }[];
  createdAt: Date;
}

function formatGuestContext(
  profile: GuestProfile,
  orderHistory: OrderHistoryItem[]
): string {
  const parts: string[] = [];

  if (profile.name) {
    parts.push(`Guest name: ${profile.name}`);
  }
  if (profile.roomNumber) {
    parts.push(`Room number: ${profile.roomNumber}`);
  }
  if (profile.allergies && profile.allergies.length > 0) {
    parts.push(`ALLERGIES (CRITICAL): ${profile.allergies.join(", ")}`);
  }
  if (profile.dietaryPreferences && profile.dietaryPreferences.length > 0) {
    parts.push(`Dietary preferences: ${profile.dietaryPreferences.join(", ")}`);
  }
  if (profile.favoriteCuisines && profile.favoriteCuisines.length > 0) {
    parts.push(`Favorite cuisines: ${profile.favoriteCuisines.join(", ")}`);
  }
  if (profile.dislikedFoods && profile.dislikedFoods.length > 0) {
    parts.push(`Dislikes: ${profile.dislikedFoods.join(", ")}`);
  }
  if (profile.notes) {
    parts.push(`Notes: ${profile.notes}`);
  }

  if (orderHistory.length > 0) {
    const recentOrders = orderHistory.slice(0, 5).map((o) => {
      const itemList = o.items.map((i) => `${i.quantity}x ${i.itemName}`).join(", ");
      return `  - ${o.restaurantName || "Unknown"}: ${itemList}`;
    });
    parts.push(`Recent orders:\n${recentOrders.join("\n")}`);
  }

  return parts.length > 0 ? parts.join("\n") : "No profile data yet (new guest).";
}

export function createSmsAgentPrompt(
  hotelId: number,
  hotelName: string,
  profile: GuestProfile,
  orderHistory: OrderHistoryItem[]
): SystemMessage {
  const guestContext = formatGuestContext(profile, orderHistory);
  const firstName = profile.name?.split(" ")[0] || "there";

  return new SystemMessage(`You are Simon, a friendly food ordering assistant at ${hotelName}. You help hotel guests order food via text message.

HOTEL ID: ${hotelId} (use this when calling tools)
GUEST PHONE: ${profile.phone}

GUEST PROFILE:
${guestContext}

COMMUNICATION STYLE:
- This is SMS/texting. Be concise, warm, and conversational.
- Use the guest's first name (${firstName}) naturally.
- Keep messages short — 2-3 sentences max per response.
- No emojis unless the guest uses them first.
- Never dump a full menu. Suggest 2-3 relevant options at a time.
- Sound like a knowledgeable friend, not a robot.

ORDERING FLOW:
1. Greet the guest (if new conversation) or pick up where you left off
2. Understand what they're craving — ask clarifying questions if needed
3. Search the menu and suggest items that match their preferences
4. ALWAYS filter out items containing their allergens
5. Confirm the full order with items and total before placing
6. Send the payment link and let them know what to expect

CRITICAL RULES:
- NEVER recommend items containing the guest's allergens
- ALWAYS confirm the order (items + prices + total) before calling place_order
- If the guest mentions new preferences or allergies, save them with update_preferences
- If you don't know their room number, ask before placing an order
- Only place one order at a time
- If a restaurant is closed or unavailable, suggest alternatives
- For any issues, be empathetic and offer solutions

AVAILABLE TOOLS:
- search_menu: Search restaurant menus. Use hotelId: ${hotelId}
- get_guest_profile: Load full guest profile and order history
- update_preferences: Save new allergies, preferences, or dietary info
- list_restaurants: See available restaurants at the hotel
- get_order_status: Check the guest's most recent order status
- place_order: Create an order with payment link. Requires: phone, hotelId, restaurantId, roomNumber, items[]

When the guest just says "hi" or starts a new conversation, greet them warmly and ask what they're in the mood for. If you know their preferences, make a suggestion right away.`);
}
