export type RestaurantDiscoveryInput = {
  address: string;
  radiusMiles: number;
  minRating: number;
  minReviews: number;
  maxResults: number;
  fetchWebsites: boolean;
  maxWebsiteLookups: number;
  discoverOrderingLinks: boolean;
  maxOrderingLinkLookups: number;
  maxOrderingCandidatesPerRestaurant: number;
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

export type OrderingPlatformFingerprint = {
  primary: OrderingPlatformSignal;
  signals: OrderingPlatformSignal[];
};

export type OrderingLinkCandidate = {
  url: string;
  host: string | null;
  label: string;
  score: number;
  platform: OrderingPlatformSignal;
  source: "website";
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
  orderingPlatformFingerprint: OrderingPlatformFingerprint | null;
  orderingLinks: OrderingLinkCandidate[];
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
    orderingLinkLookupsAttempted: number;
    orderingLinkLookupsSucceeded: number;
  };
  warnings: string[];
};

// These result types are shared between Server Actions and Client Components.
// Keep them in this file (no `server-only`) so client code can safely import the types.
export type OrderSurfaceProbeResult = {
  url: string;
  startedAt: string;
  durationMs: number;
  providerHint: "slice" | "toast" | "chownow" | "square" | "unknown";
  passed: boolean;
  checks: {
    reachedSite: boolean;
    botBlocked: boolean;
    addedItemToCart: boolean;
    reachedCheckout: boolean;
    guestCardEntryVisible: boolean;
    loginRequiredForCard: boolean;
    walletOnly: boolean;
  };
  notes: string[];
  errorMessage: string | null;
};

export type OrderingLinkDeepScanResult = {
  inputUrl: string;
  finalUrl: string;
  startedAt: string;
  durationMs: number;
  clickedOrderCta: boolean;
  fingerprint: OrderingPlatformFingerprint | null;
  orderingLinks: OrderingLinkCandidate[];
  notes: string[];
  errorMessage: string | null;
};
