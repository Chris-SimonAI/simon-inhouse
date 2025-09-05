import "server-only";
import { env } from "@/env";
import { type SearchPlacesArgsInput, PlaceIdSchema } from "@/validations/places";
import { parseCategory, formatPriceLevel } from "@/lib/place-utils";

interface GooglePlace {
  id: string;
  displayName?: { text?: string } | string;
  types?: string[];
  rating?: number;
  priceLevel?: string;
  editorialSummary?: {
    text?: string;
    languageCode?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  formattedAddress?: string;
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

export type PlaceResult = {
  id: string;
  name: string;
  price?: string;
  rating?: number;
  photo?: string;
  category: string;
  editorialSummary?: {
    text?: string;
    languageCode?: string;
  };
  latitude?: number;
  longitude?: number;
  address?: string;
  placeType: 'restaurant' | 'attraction';
};

export type PlaceDetails = {
  id: string;
  name: string;
  description?: string;
  reviewSummary?: string;
  neighborhoodSummary?: string;
  photos: Array<string>;
  rating?: number;
  priceLevel?: string;
  address?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
};


export type SearchResults = PlaceResult[];

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

export async function searchRestaurants(args: SearchPlacesArgs): Promise<SearchResults> {
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
    "places.priceLevel", "places.photos", "places.editorialSummary",
    "places.location", "places.formattedAddress"
  ].join(",");
  const data = await callPlaces("/places:searchText", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask
  });
  const places = data.places ?? [];

  const results = places.map((p: GooglePlace): PlaceResult => {
    const photo = p.photos?.[0] ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&key=${env.GOOGLE_PLACES_API_KEY}` : undefined;
    const category = parseCategory(p.types, "_restaurant", "Restaurant");

    return {
      id: p.id,
      name: typeof p.displayName === 'object' ? p.displayName?.text ?? "" : p.displayName ?? "",
      price: formatPriceLevel(p.priceLevel),
      rating: p.rating,
      photo,
      category,
      editorialSummary: p.editorialSummary,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      address: p.formattedAddress,
      placeType: 'restaurant'
    };
  });

  return results;
}

export async function searchAttractions(args: SearchPlacesArgs): Promise<SearchResults> {
  const radiusMeters = Math.min(Math.max(Math.round(args.radiusKm * 1000), 1), 50000);

  const body = {
    textQuery: args.query,
    pageSize: args.maxResults,
    includedType: "tourist_attraction",
    openNow: args.openNow,
    locationBias: { circle: { center: { latitude: args.latitude, longitude: args.longitude }, radius: radiusMeters } },
    rankPreference: "RELEVANCE"
  };
  const fieldMask = [
    "places.id", "places.displayName", "places.types", "places.rating",
    "places.priceLevel", "places.photos", "places.editorialSummary",
    "places.location", "places.formattedAddress"
  ].join(",");
  const data = await callPlaces("/places:searchText", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask
  });
  const places = data.places ?? [];

  const results = places.map((p: GooglePlace): PlaceResult => {
    const photo = p.photos?.[0] ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&key=${env.GOOGLE_PLACES_API_KEY}` : undefined;
    const category = parseCategory(p.types, "_attraction", "Attraction");

    return {
      id: p.id,
      name: typeof p.displayName === 'object' ? p.displayName?.text ?? "" : p.displayName ?? "",
      price: formatPriceLevel(p.priceLevel),
      rating: p.rating,
      photo,
      category,
      editorialSummary: p.editorialSummary,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      address: p.formattedAddress,
      placeType: 'attraction'
    };
  });

  return results;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const validatedPlaceId = PlaceIdSchema.parse(placeId);

  const fieldMask = [
    "id",
    "displayName",
    "editorialSummary",
    "reviewSummary",
    "generativeSummary",
    "neighborhoodSummary",
    "photos",
    "rating",
    "priceLevel",
    "formattedAddress",
    "location",
    "types",
    "websiteUri",
    "internationalPhoneNumber",
  ].join(",");

  const data = await callPlaces(`/places/${validatedPlaceId}`, {
    method: "GET",
    fieldMask
  });

  const editorialSummary = data.editorialSummary?.text || "";


  const generativeSummary = data.generativeSummary?.overview?.text || "";

  const description = editorialSummary ||
    generativeSummary ||
    "";

  const reviewSummary = data.reviewSummary?.text?.text || "";

  const neighborhoodSummary = data.neighborhoodSummary?.overview?.content?.text || "" + " " + data.neighborhoodSummary?.description?.content?.text || "";

  const photos = (data.photos || []).map((photo: { name: string }) => `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=800&key=${env.GOOGLE_PLACES_API_KEY}`);

  const result: PlaceDetails = {
    id: data.id,
    name: typeof data.displayName === 'object' ? data.displayName?.text ?? "" : data.displayName ?? "",
    description,
    reviewSummary,
    neighborhoodSummary,
    photos,
    rating: data.rating,
    priceLevel: data.priceLevel,
    address: data.formattedAddress,
    location: data.location ? {
      latitude: data.location.latitude,
      longitude: data.location.longitude
    } : undefined,
    types: data.types,
    websiteUri: data.websiteUri,
    internationalPhoneNumber: data.internationalPhoneNumber
  };

  return result;
}
