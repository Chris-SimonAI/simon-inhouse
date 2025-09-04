import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { searchRestaurants, searchAttractions } from "@/lib/places";
import { SearchPlacesArgsSchema, SearchPlacesArgsInput } from "@/validations/places";


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

// Legacy tool for backward compatibility
export const searchPlaces = searchRestaurantsTool;


export const check_availability_stub = new DynamicTool({
  name: "check_availability",
  description: "Check room availability for dates",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async func(_input: string) {
    const availabilityData = {
      available: true,
      rooms: [
        { type: "Standard", price: 150 },
        { type: "Deluxe", price: 200 }
      ],
      dates: "2024-03-15 to 2024-03-17"
    };

    return availabilityData;
  },
});
