import "server-only";
import { env } from "@/env";
import { type SearchPlacesArgsInput } from "@/validations/places";
import { formatPriceLevel } from "@/lib/price";

interface GooglePlace {
  id: string;
  displayName?: { text?: string } | string;
  types?: string[];
  rating?: number;
  priceLevel?: string;
  editorialSummary?: string;
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions: Array<{
      displayName: string;
      uri: string;
      photoUri: string;
    }>;
  }>;
}

export type SearchPlacesArgs = SearchPlacesArgsInput;

export type RestaurantResult = {
  name: string;
  price?: string;
  rating?: number;
  photo?: string;
  cuisine: string;
  editorialSummary?: string;
};

export type SearchResults = Array<RestaurantResult>;

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
    "places.id", "places.displayName", "places.types", "places.rating",
    "places.priceLevel", "places.photos", "places.editorialSummary"
  ].join(",");
  const data = await callPlaces("/places:searchText", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask
  });
  const places = data.places ?? [];

  const results = places.map((p: GooglePlace) => {
    const cats = (p.types || []).filter((t: string) => !t.includes("point_of_interest") && !t.includes("establishment"));
    const photo = p.photos?.[0] ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&key=${env.GOOGLE_PLACES_API_KEY}` : undefined;

    return {
      id: p.id,
      name: typeof p.displayName === 'object' ? p.displayName?.text ?? "" : p.displayName ?? "",
      price: formatPriceLevel(p.priceLevel),
      rating: p.rating,
      photo,
      cuisine: cats.length > 0 ? cats[0].replace(/_restaurant$/, '').replace(/_/g, ' ') : "Restaurant",
      editorialSummary: p.editorialSummary
    };
  });

  return results;
}
