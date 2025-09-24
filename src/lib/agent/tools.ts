import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { searchRestaurants, searchAttractions } from "@/lib/places";
import { SearchPlacesArgsSchema, SearchPlacesArgsInput } from "@/validations/places";
import { getAmenitiesByHotelId } from "@/actions/amenities";
import { getDineInRestaurantsByHotelId } from "@/actions/dine-in-restaurants";

export const searchRestaurantsTool = new DynamicStructuredTool({
  name: "search_restaurants",
  description:
    `Find restaurants near a lat/lng (Google Places).
  ALWAYS call this for dining requests—even with defaults.
  Args: lat, lng, radiusKm, query, open_now, maxResults.
  Example call: {"lat":37.7749,"lng":-122.4194,"radiusKm":2,"query":"italian dinner","open_now":true}`,
  schema: SearchPlacesArgsSchema,
  func: async (args) => {
    try {
      const result = await searchRestaurants(args as SearchPlacesArgsInput);
      return JSON.stringify({
        data: result,
      });
    } catch (err) {
      return JSON.stringify({
        error: "GOOGLE_PLACES_SEARCH_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const searchAttractionsTool = new DynamicStructuredTool({
  name: "search_attractions",
  description:
    `Find tourist attractions near a lat/lng (Google Places).
  ALWAYS call this for attraction requests—even with defaults.
  Args: lat, lng, radiusKm, query, open_now, maxResults.
  Example call: {"lat":37.7749,"lng":-122.4194,"radiusKm":2,"query":"attraction","open_now":true}`,
  schema: SearchPlacesArgsSchema,
  func: async (args) => {
    try {
      const result = await searchAttractions(args as SearchPlacesArgsInput);
      return JSON.stringify({
        data: result,
      });
    } catch (err) {
      return JSON.stringify({
        error: "GOOGLE_PLACES_SEARCH_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const getAmenitiesTool = new DynamicTool({
  name: "get_amenities",
  description: "Get all amenities available at the hotel. Use this for questions about hotel facilities, services, and amenities like pool, gym, spa, restaurant, bar, etc. Input: hotel ID as a string (e.g., '1')",
  func: async (input: string) => {
    try {
      // The hotelId will be passed through the tool context, but for now we take it as input
      const hotelId = parseInt(input);
      if (isNaN(hotelId)) {
        return JSON.stringify({
          error: "INVALID_HOTEL_ID",
          message: "Hotel ID must be a valid number"
        });
      }

      const result = await getAmenitiesByHotelId(hotelId);
      if (!result.ok) {
        return JSON.stringify({
          error: "AMENITIES_FETCH_FAILED",
          message: result.message || "Failed to fetch amenities"
        });
      }

      return JSON.stringify({
        data: result.data
      });
    } catch (err) {
      return JSON.stringify({
        error: "AMENITIES_TOOL_ERROR",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  },
});

export const emitPrefaceTool = new DynamicTool({
  name: "emit_preface",
  description: `Output your warm, engaging preface response to the guest. The 'text' parameter should contain YOUR 2-sentence response that acknowledges what the guest asked for and builds anticipation - NOT the guest's original question. 

Example: If guest asks "Can you recommend nearby attractions?" you should call this tool with text like "Absolutely—I'd love to help you discover some fantastic attractions around here. Let me share some local gems that'll make your stay memorable."`,
  func: async (text: string) => {
    return text;
  },
});

export const getDineInRestaurantsTool = new DynamicTool({
  name: "get_dine_in_restaurants",
  description:
    "Get all on-property restaurants managed by the hotel/group. Use this when guests ask about our in-house dining options. Input: hotel ID as a string (e.g., '1')",
  func: async (input: string) => {
    const hotelId = parseInt(input);
    try {
      if (isNaN(hotelId)) {
        return JSON.stringify({
          error: "INVALID_HOTEL_ID",
          message: "Hotel ID must be a valid number"
        });
      }
      const result = await getDineInRestaurantsByHotelId(hotelId);
      if (!result.ok) {
        return JSON.stringify({
          error: "DINE_IN_RESTAURANTS_FETCH_FAILED",
          message: result.message || "Failed to fetch restaurants",
        });
      }
      return JSON.stringify({ data: result.data });
    } catch (err) {
      return JSON.stringify({
        error: "DINE_IN_RESTAURANTS_TOOL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
});


export const initiateTippingTool = new DynamicTool({
  name: "initiate_tipping",
  description:
        "Initiate the tipping process when guests want to tip hotel service team. Use this when guests ask about tipping, want to leave a tip, or show appreciation for service. Input should be in format 'hotelId:message' where hotelId is the hotel ID number and message is what you want to display to the guest on the tipping page, or 'hotelId:start' for default message.",
  func: async (input: string) => {
    const [hotelIdStr, messageInput] = input.split(':', 2);
    const hotelId = parseInt(hotelIdStr);
    
    if (isNaN(hotelId)) {
      return JSON.stringify({
        error: "INVALID_HOTEL_ID",
        message: "Hotel ID must be provided as a valid number"
      });
    }
    
    const message = messageInput === 'start' ? undefined : messageInput;
    let url = `/tip-staff?hotelId=${hotelId}`;
    if (message) {
      url += `&message=${encodeURIComponent(message)}`;
    }
    
    return JSON.stringify({
      action: "navigate_to_tipping",
      message: "I'd be happy to help you tip our wonderful service team! Let me take you to our tipping system where you can show your appreciation to any of our team members.",
      url: url
    });
  },
});