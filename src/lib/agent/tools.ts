import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { searchRestaurants, searchAttractions } from "@/lib/places";
import { SearchPlacesArgsSchema, SearchPlacesArgsInput } from "@/validations/places";
import { getAmenitiesByHotelId } from "@/actions/amenities";


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
  description:
    "Emit exactly ONE warm, personal, thoughtful preface sentence that acknowledges and connects with the guest's specific request (<=140 chars). Show genuine interest in their situation. Use at most once per turn.",
  func: async (text: string) => {
    return text;
  },
});