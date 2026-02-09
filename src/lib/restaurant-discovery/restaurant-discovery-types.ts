export type RestaurantDiscoveryInput = {
  address: string;
  radiusMiles: number;
  minRating: number;
  minReviews: number;
  maxResults: number;
  fetchWebsites: boolean;
  maxWebsiteLookups: number;
};

export type OrderingPlatformId =
  | "toast"
  | "chownow"
  | "slice"
  | "olo"
  | "square"
  | "clover"
  | "bentobox"
  | "popmenu"
  | "other"
  | "unknown";

export type OrderingPlatformSignal = {
  id: OrderingPlatformId;
  label: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type DiscoveredRestaurant = {
  name: string;
  placeId: string;
  mapsUrl: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  websiteUrl: string | null;
  websiteHost: string | null;
  orderingPlatform: OrderingPlatformSignal;
};

export type RestaurantDiscoveryResult = {
  input: RestaurantDiscoveryInput;
  geo: { lat: number; lng: number; formattedAddress: string | null };
  restaurants: DiscoveredRestaurant[];
  stats: {
    candidatesFromPlaces: number;
    afterFilters: number;
    websiteLookupsAttempted: number;
    websiteLookupsSucceeded: number;
  };
  warnings: string[];
};

