import "server-only";
import { env } from "@/env";
import { type SearchPlacesArgsInput } from "@/validations/places";

interface GooglePlace {
  id: string;
  displayName?: { text?: string } | string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
}

interface GooglePlaceDetails {
  id: string;
  displayName?: { text?: string } | string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

export type SearchPlacesArgs = SearchPlacesArgsInput;

export type SearchResults = {
  results: Array<{
    name: string;
    distanceKm: number;
    cuisine: string;
    priceRange?: string;
    description?: string;
    rating?: number;
    reviewCount?: number;
    address?: string;
    phone?: string;
    url?: string;
  }>;
  searchQuery: string;
  radiusSearched: number;
};

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1";

async function callPlaces(path: string, init: RequestInit & { fieldMask: string }) {
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
    "X-Goog-FieldMask": init.fieldMask,
  };
  const res = await fetch(`${GOOGLE_PLACES_ENDPOINT}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

export async function googlePlacesSearch(args: SearchPlacesArgs): Promise<SearchResults> {
  const radiusMeters = Math.min(Math.max(Math.round(args.radiusKm * 1000), 1), 50000);

  const body = {
    textQuery: args.query,
    pageSize: args.maxResults,
    includedType: "restaurant",
    openNow: args.openNow,
    locationBias: { circle: { center: { latitude: args.latitude, longitude: args.longitude }, radius: radiusMeters } },
    rankPreference: "RELEVANCE"
  };
  const fieldMask = [
    "places.name", "places.id", "places.displayName", "places.shortFormattedAddress",
    "places.location", "places.types", "places.rating", "places.userRatingCount",
    "places.priceLevel", "places.googleMapsUri"
  ].join(",");
  const data = await callPlaces("/places:searchText", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask
  });
  const places = data.places ?? [];

  const base = places.map((p: GooglePlace) => {
    const lat = p.location?.latitude, lng = p.location?.longitude;
    const dist = (lat && lng) ? +Math.abs(args.latitude - lat).toFixed(2) : 0;
    const cats = (p.types || []).filter((t: string) => !t.includes("point_of_interest") && !t.includes("establishment"));
    return {
      id: p.id,
      name: typeof p.displayName === 'object' ? p.displayName?.text ?? "" : p.displayName ?? "",
      distanceKm: dist,
      cuisine: cats.join(" • ") || "Restaurant",
      priceRange: p.priceLevel,
      rating: p.rating,
      reviewCount: p.userRatingCount,
      address: p.shortFormattedAddress,
      url: p.googleMapsUri
    };
  });

  let enriched = base;
  if (args.enrichDetails && base.length) {
    const fieldMask = [
      "id", "displayName", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri"
    ].join(",");
    const updates = await Promise.all(
      base.slice(0, args.detailsLimit).map(async (b: { id: string; name: string; distanceKm: number; cuisine: string; priceRange: string; rating: number; reviewCount: number; address: string; url: string; }) => {
        const details: GooglePlaceDetails = await callPlaces(`/places/${encodeURIComponent(b.id)}`, {
          method: "GET",
          fieldMask
        });
        return {
          ...b,
          phone: details.nationalPhoneNumber ?? details.internationalPhoneNumber,
          url: details.websiteUri ?? b.url
        };
      })
    );
    enriched = [...updates, ...base.slice(args.detailsLimit)];
  }

  return {
    results: enriched.map((place: { id: string; name: string; distanceKm: number; cuisine: string; priceRange: string; rating: number; reviewCount: number; address: string; url: string; }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = place;
      return rest;
    }),
    searchQuery: args.query,
    radiusSearched: +(radiusMeters / 1000).toFixed(2)
  };
}
