import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { googlePlacesSearch } from "@/lib/places";
import { SearchPlacesArgsSchema, SearchPlacesArgsInput } from "@/validations/places";


export const searchPlaces = new DynamicStructuredTool({
  name: "search_places",
  description:
  `Find restaurants near a lat/lng (Google Places).
  ALWAYS call this for dining requests—even with defaults.
  Args: lat, lng, radius_m, query, open_now, price_level(1–4), sort(rating|distance), reservation_time(ISO 8601), party_size.
  Example call: {"lat":37.7749,"lng":-122.4194,"radius_m":2000,"query":"sushi","open_now":true,"sort":"rating"}`,
  schema: SearchPlacesArgsSchema,
  func: async (args) => {
    try {
      const result = await googlePlacesSearch(args as SearchPlacesArgsInput);
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
