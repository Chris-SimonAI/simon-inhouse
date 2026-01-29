import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createError, createSuccess } from '@/lib/utils';
import {
  getChatContext,
  addMessageToConversation,
  bulkUpsertGuestPreferences,
  getConversation,
} from '@/actions/test-chat';
import type { ChatMessage } from '@/db/schemas/chat-conversations';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize Anthropic client
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

// Build the system prompt with all context
function buildSystemPrompt(context: {
  guest: {
    id: number;
    name: string | null;
    phone: string;
    roomNumber: string | null;
    allergies: string[] | null;
    dietaryPreferences: string[] | null;
    favoriteCuisines: string[] | null;
    dislikedFoods: string[] | null;
  };
  detailedPreferences: Array<{
    preferenceType: string;
    preferenceValue: string;
    confidence: string;
    source: string;
  }>;
  hotel: {
    id: number;
    name: string;
    address: string | null;
  };
  restaurants: Array<{
    restaurant: {
      id: number;
      name: string;
      description: string | null;
      cuisine: string | null;
      addressLine1: string | null;
      phoneNumber: string | null;
      deliveryFee: string;
      serviceFeePercent: string;
    };
    menu: {
      groups: Array<{
        id: string;
        name: string;
        items: Array<{
          id: string;
          name: string;
          description: string;
          price: number;
          calories: number;
          allergens: string[];
          isAvailable: boolean;
          modifierGroups: Array<{
            id: string;
            name: string;
            isRequired: boolean;
            options: Array<{
              id: string;
              name: string;
              price: number;
            }>;
          }>;
        }>;
      }>;
    } | null;
  }>;
}) {
  const { guest, detailedPreferences, hotel, restaurants } = context;

  // Format preferences for the prompt
  const preferenceSummary = detailedPreferences.length > 0
    ? detailedPreferences
        .map((p) => `- ${p.preferenceType}: ${p.preferenceValue} (confidence: ${p.confidence}, source: ${p.source})`)
        .join('\n')
    : 'No preferences recorded yet.';

  // Format restaurants and menus
  const restaurantInfo = restaurants
    .map(({ restaurant, menu }) => {
      let info = `\n## ${restaurant.name}`;
      if (restaurant.cuisine) info += ` (${restaurant.cuisine})`;
      info += `\nID: ${restaurant.id}`;
      if (restaurant.description) info += `\nDescription: ${restaurant.description}`;
      info += `\nDelivery Fee: $${parseFloat(restaurant.deliveryFee).toFixed(2)}`;
      info += `\nService Fee: ${parseFloat(restaurant.serviceFeePercent)}%`;

      if (menu && menu.groups.length > 0) {
        info += '\n\n### Menu:';
        for (const group of menu.groups) {
          info += `\n\n#### ${group.name}`;
          for (const item of group.items) {
            if (!item.isAvailable) continue;
            info += `\n- **${item.name}** - $${item.price.toFixed(2)}`;
            if (item.description) info += `\n  ${item.description}`;
            if (item.calories) info += ` (${item.calories} cal)`;
            if (item.allergens && item.allergens.length > 0) {
              info += `\n  Allergens: ${item.allergens.join(', ')}`;
            }
            if (item.modifierGroups && item.modifierGroups.length > 0) {
              for (const mod of item.modifierGroups) {
                info += `\n  ${mod.isRequired ? '[Required]' : '[Optional]'} ${mod.name}: ${mod.options.map((o) => `${o.name}${o.price > 0 ? ` (+$${o.price.toFixed(2)})` : ''}`).join(', ')}`;
              }
            }
          }
        }
      }

      return info;
    })
    .join('\n\n---\n');

  return `You are Simon, a friendly and helpful food concierge at ${hotel.name}. You help hotel guests discover and order food from nearby restaurants.

## Your Personality
- Friendly, concise, not overly formal
- Ask smart clarifying questions when needed
- Remember everything from the conversation
- Make specific recommendations with prices
- Handle "I don't know, just pick something" gracefully by making a good recommendation
- Extract and remember preferences naturally during conversation

## Current Guest
- Name: ${guest.name || 'Guest'}
- Room: ${guest.roomNumber || 'Not specified'}
- Phone: ${guest.phone}

## Guest's Known Preferences
${preferenceSummary}

## Legacy Profile Data
- Allergies: ${guest.allergies?.join(', ') || 'None recorded'}
- Dietary Preferences: ${guest.dietaryPreferences?.join(', ') || 'None recorded'}
- Favorite Cuisines: ${guest.favoriteCuisines?.join(', ') || 'None recorded'}
- Disliked Foods: ${guest.dislikedFoods?.join(', ') || 'None recorded'}

## Hotel Location
${hotel.name}
${hotel.address || ''}

## Available Restaurants & Menus
${restaurantInfo || 'No restaurants available at this location.'}

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "response": "Your conversational message to the guest",
  "preferences_detected": [
    {"type": "allergy", "value": "peanuts", "confidence": 1.0},
    {"type": "cuisine_like", "value": "thai", "confidence": 0.8}
  ],
  "order_intent": null
}

For preferences_detected, use these types:
- "allergy" - food allergies (confidence 1.0 if explicitly stated)
- "dietary" - dietary restrictions like vegetarian, vegan, halal, kosher
- "cuisine_like" - cuisines they enjoy
- "cuisine_dislike" - cuisines they don't like
- "spice_level" - preferred spice level (mild, medium, spicy, extra spicy)
- "price_range" - budget preferences (budget, moderate, expensive)
- "dislike" - specific foods they don't like

For order_intent, when the guest wants to order, include:
{
  "order_intent": {
    "restaurant_id": 123,
    "items": [
      {
        "menu_item_id": "guid-here",
        "name": "Item Name",
        "price": 16.00,
        "quantity": 1,
        "modifiers": ["Medium spice"]
      }
    ],
    "ready_to_confirm": false
  }
}

Set ready_to_confirm to true only when the guest explicitly confirms they want to place the order.

Remember: Always respond with valid JSON only. No text before or after the JSON.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, guestId, hotelId, message } = body as {
      conversationId: number;
      guestId: number;
      hotelId: number;
      message: string;
    };

    if (!conversationId || !guestId || !hotelId || !message) {
      return NextResponse.json(
        createError('Missing required fields: conversationId, guestId, hotelId, message'),
        { status: 400 }
      );
    }

    // Get conversation history
    const conversationResult = await getConversation(conversationId);
    if (!conversationResult.ok) {
      return NextResponse.json(
        createError('Conversation not found'),
        { status: 404 }
      );
    }
    const conversation = conversationResult.data;

    // Get full context for Claude
    const contextResult = await getChatContext(guestId, hotelId);
    if (!contextResult.ok) {
      return NextResponse.json(
        createError('Failed to load chat context'),
        { status: 500 }
      );
    }

    // Add user message to conversation
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    await addMessageToConversation(conversationId, userMessage);

    // Build messages array for Claude
    const systemPrompt = buildSystemPrompt(contextResult.data);

    // Convert conversation history to Claude format
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of conversation.messages || []) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: message,
    });

    // Call Claude
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract the response text
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse Claude's JSON response
    let parsedResponse: {
      response: string;
      preferences_detected: Array<{
        type: string;
        value: string;
        confidence: number;
      }>;
      order_intent: {
        restaurant_id: number;
        items: Array<{
          menu_item_id: string;
          name: string;
          price: number;
          quantity: number;
          modifiers?: string[];
        }>;
        ready_to_confirm: boolean;
      } | null;
    };

    try {
      // Try to parse as JSON, handling potential markdown code blocks
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      parsedResponse = JSON.parse(jsonStr.trim());
    } catch {
      // If parsing fails, treat the whole response as the message
      console.error('Failed to parse Claude response as JSON:', responseText);
      parsedResponse = {
        response: responseText,
        preferences_detected: [],
        order_intent: null,
      };
    }

    // Save detected preferences
    if (parsedResponse.preferences_detected && parsedResponse.preferences_detected.length > 0) {
      await bulkUpsertGuestPreferences(guestId, parsedResponse.preferences_detected);
    }

    // Add assistant message to conversation
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: parsedResponse.response,
      timestamp: new Date().toISOString(),
      metadata: {
        preferencesDetected: parsedResponse.preferences_detected,
        orderIntent: parsedResponse.order_intent
          ? {
              restaurantId: parsedResponse.order_intent.restaurant_id,
              items: parsedResponse.order_intent.items.map((item) => ({
                menuItemId: parseInt(item.menu_item_id) || 0,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                modifiers: item.modifiers,
              })),
              readyToConfirm: parsedResponse.order_intent.ready_to_confirm,
            }
          : null,
      },
    };
    await addMessageToConversation(conversationId, assistantMessage);

    return NextResponse.json(
      createSuccess({
        message: parsedResponse.response,
        preferencesDetected: parsedResponse.preferences_detected,
        orderIntent: parsedResponse.order_intent,
      })
    );
  } catch (error) {
    console.error('Error in POST /api/admin/test-chat:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(createError(message), { status: 500 });
  }
}
