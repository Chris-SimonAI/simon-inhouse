'use server';

import 'server-only';

import { z } from 'zod';
import { env } from '@/env';
import { createError, createSuccess } from '@/lib/utils';
import { detectOrderingPlatformFromWebsite } from '@/lib/restaurant-discovery/platform-detector';
import { extractOrderingLinksFromWebsiteHtml } from '@/lib/restaurant-discovery/order-link-extractor';
import { fingerprintOrderingPlatformFromHtml } from '@/lib/restaurant-discovery/platform-fingerprinter';
import {
  type DiscoveredRestaurant,
  type RestaurantDiscoveryInput,
  type RestaurantDiscoveryResult,
} from '@/lib/restaurant-discovery/restaurant-discovery-types';

const restaurantDiscoverySchema = z.object({
  address: z.string().min(5).max(220),
  radiusMiles: z.number().min(1).max(15),
  minRating: z.number().min(0).max(5),
  minReviews: z.number().int().min(0).max(20000),
  maxResults: z.number().int().min(1).max(60),
  fetchWebsites: z.boolean(),
  maxWebsiteLookups: z.number().int().min(0).max(25),
  discoverOrderingLinks: z.boolean(),
  maxOrderingLinkLookups: z.number().int().min(0).max(25),
  maxOrderingCandidatesPerRestaurant: z.number().int().min(1).max(10),
});

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
  error_message?: string;
};

type GooglePlacesNearbyResponse = {
  status: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    vicinity?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    business_status?: string;
  }>;
  next_page_token?: string;
  error_message?: string;
};

type GooglePlaceDetailsResponse = {
  status: string;
  result?: {
    website?: string;
    url?: string;
    formatted_address?: string;
  };
  error_message?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    // Avoid caching since results are request-specific and can change frequently.
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function toMeters(miles: number) {
  return Math.round(miles * 1609.344);
}

function toMapsPlaceUrl(placeId: string) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

function safeHostFromUrl(url: string | null) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function clampRestaurants<T>(items: T[], max: number) {
  if (items.length <= max) {
    return items;
  }
  return items.slice(0, max);
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Some sites block unknown UAs; this is a best-effort fetch for discovery only.
        'user-agent':
          'Mozilla/5.0 (compatible; SimonDiscoveryBot/1.0; +https://simon.ai)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    // Keep memory bounded.
    return text.slice(0, 1_000_000);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runRestaurantDiscovery(input: unknown) {
  const parsed = restaurantDiscoverySchema.safeParse(input);
  if (!parsed.success) {
    return createError('Invalid discovery request', parsed.error.flatten());
  }

  const request: RestaurantDiscoveryInput = parsed.data;

  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return createError(
      'GOOGLE_PLACES_API_KEY is not set. Add it in Railway (or local env) to use Restaurant Discovery.',
    );
  }

  const warnings: string[] = [];

  let geoLat: number | null = null;
  let geoLng: number | null = null;
  let formattedAddress: string | null = null;

  try {
    const geocodeUrl = new URL(
      'https://maps.googleapis.com/maps/api/geocode/json',
    );
    geocodeUrl.searchParams.set('address', request.address);
    geocodeUrl.searchParams.set('key', apiKey);

    const geo = await fetchJson<GoogleGeocodeResponse>(geocodeUrl.toString());
    if (geo.status !== 'OK' || !geo.results || geo.results.length === 0) {
      const detail = geo.error_message ? ` (${geo.error_message})` : '';
      return createError(`Geocoding failed with status ${geo.status}${detail}`);
    }

    const first = geo.results[0];
    formattedAddress = first.formatted_address ?? null;
    geoLat = first.geometry?.location?.lat ?? null;
    geoLng = first.geometry?.location?.lng ?? null;
    if (geoLat === null || geoLng === null) {
      return createError('Geocoding did not return a usable lat/lng');
    }
  } catch (error) {
    console.error('Restaurant discovery geocode error:', error);
    return createError('Failed to geocode address');
  }

  const radiusMeters = toMeters(request.radiusMiles);

  const candidatePlaces: Array<{
    placeId: string;
    name: string;
    rating: number | null;
    userRatingsTotal: number | null;
    priceLevel: number | null;
    vicinity: string | null;
    location: { lat: number; lng: number } | null;
    businessStatus: string | null;
  }> = [];

  try {
    let nextToken: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const placesUrl = new URL(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      );
      placesUrl.searchParams.set('location', `${geoLat},${geoLng}`);
      placesUrl.searchParams.set('radius', String(radiusMeters));
      placesUrl.searchParams.set('type', 'restaurant');
      placesUrl.searchParams.set('key', apiKey);
      if (nextToken) {
        placesUrl.searchParams.set('pagetoken', nextToken);
      }

      // Google requires a short delay before next_page_token becomes valid.
      if (nextToken) {
        await sleep(2000);
      }

      const places = await fetchJson<GooglePlacesNearbyResponse>(
        placesUrl.toString(),
      );

      if (places.status !== 'OK' && places.status !== 'ZERO_RESULTS') {
        const detail = places.error_message ? ` (${places.error_message})` : '';
        return createError(
          `Places Nearby Search failed with status ${places.status}${detail}`,
        );
      }

      for (const place of places.results ?? []) {
        const placeId = place.place_id;
        const name = place.name;
        if (!placeId || !name) {
          continue;
        }

        candidatePlaces.push({
          placeId,
          name,
          rating: typeof place.rating === 'number' ? place.rating : null,
          userRatingsTotal:
            typeof place.user_ratings_total === 'number'
              ? place.user_ratings_total
              : null,
          priceLevel:
            typeof place.price_level === 'number' ? place.price_level : null,
          vicinity: place.vicinity ?? null,
          location:
            typeof place.geometry?.location?.lat === 'number' &&
            typeof place.geometry?.location?.lng === 'number'
              ? {
                  lat: place.geometry.location.lat,
                  lng: place.geometry.location.lng,
                }
              : null,
          businessStatus: place.business_status ?? null,
        });
      }

      if (candidatePlaces.length >= request.maxResults) {
        break;
      }

      nextToken = places.next_page_token;
      if (!nextToken) {
        break;
      }

      if ((places.results ?? []).length === 0) {
        break;
      }
    }
  } catch (error) {
    console.error('Restaurant discovery places error:', error);
    return createError('Failed to load nearby restaurants');
  }

  const candidatesFromPlaces = candidatePlaces.length;

  const filtered = candidatePlaces.filter((place) => {
    const ratingOk =
      place.rating === null ? false : place.rating >= request.minRating;
    const reviewsOk =
      place.userRatingsTotal === null
        ? false
        : place.userRatingsTotal >= request.minReviews;

    return ratingOk && reviewsOk;
  });

  const capped = clampRestaurants(filtered, request.maxResults);

  let websiteLookupsAttempted = 0;
  let websiteLookupsSucceeded = 0;
  let orderingLinkLookupsAttempted = 0;
  let orderingLinkLookupsSucceeded = 0;

  const lookupBudget = request.fetchWebsites ? request.maxWebsiteLookups : 0;
  const orderingLinkBudget = request.discoverOrderingLinks
    ? request.maxOrderingLinkLookups
    : 0;

  const restaurants: DiscoveredRestaurant[] = [];

  for (const place of capped) {
    let websiteUrl: string | null = null;
    let address: string | null = place.vicinity;
    let orderingLinks: DiscoveredRestaurant['orderingLinks'] = [];
    let orderingPlatformFingerprint: DiscoveredRestaurant['orderingPlatformFingerprint'] =
      null;

    if (lookupBudget > 0 && websiteLookupsAttempted < lookupBudget) {
      websiteLookupsAttempted += 1;
      try {
        const detailsUrl = new URL(
          'https://maps.googleapis.com/maps/api/place/details/json',
        );
        detailsUrl.searchParams.set('place_id', place.placeId);
        detailsUrl.searchParams.set('fields', 'website,url,formatted_address');
        detailsUrl.searchParams.set('key', apiKey);

        const details = await fetchJson<GooglePlaceDetailsResponse>(
          detailsUrl.toString(),
        );
        if (details.status === 'OK') {
          websiteUrl = details.result?.website ?? null;
          address = details.result?.formatted_address ?? address;
          websiteLookupsSucceeded += 1;
        } else if (details.status !== 'ZERO_RESULTS') {
          warnings.push(
            `Place details for "${place.name}" returned status ${details.status}`,
          );
        }
      } catch (error) {
        console.warn('Restaurant discovery details fetch failed:', error);
        warnings.push(`Place details lookup failed for "${place.name}"`);
      }
    }

    const platform = detectOrderingPlatformFromWebsite(websiteUrl);

    if (
      websiteUrl &&
      orderingLinkBudget > 0 &&
      orderingLinkLookupsAttempted < orderingLinkBudget
    ) {
      orderingLinkLookupsAttempted += 1;
      try {
        const html = await fetchTextWithTimeout(websiteUrl, 12_000);
        orderingPlatformFingerprint = fingerprintOrderingPlatformFromHtml({
          websiteUrl,
          html,
        });
        orderingLinks = extractOrderingLinksFromWebsiteHtml({
          websiteUrl,
          html,
          maxCandidates: request.maxOrderingCandidatesPerRestaurant,
        });
        orderingLinkLookupsSucceeded += 1;
      } catch (error) {
        console.warn('Restaurant discovery ordering link fetch failed:', error);
        warnings.push(`Ordering link scan failed for "${place.name}"`);
      }
    }

    restaurants.push({
      name: place.name,
      placeId: place.placeId,
      mapsUrl: toMapsPlaceUrl(place.placeId),
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      priceLevel: place.priceLevel,
      address,
      location: place.location,
      websiteUrl,
      websiteHost: safeHostFromUrl(websiteUrl),
      orderingPlatform: platform,
      orderingPlatformFingerprint,
      orderingLinks,
    });
  }

  if (!request.fetchWebsites) {
    warnings.push(
      'Website/platform detection is disabled. Enable "Fetch websites" to classify ordering providers.',
    );
  } else if (lookupBudget === 0) {
    warnings.push(
      'Website/platform detection is enabled but maxWebsiteLookups is 0, so no lookups were performed.',
    );
  } else if (websiteLookupsAttempted < restaurants.length) {
    warnings.push(
      `Website lookups were limited (${websiteLookupsAttempted}/${restaurants.length}). Increase maxWebsiteLookups to classify more restaurants.`,
    );
  }

  if (!request.discoverOrderingLinks) {
    warnings.push(
      'Ordering link discovery is disabled. Enable "Discover ordering links" to find provider/whitelabel order pages.',
    );
  } else if (orderingLinkBudget === 0) {
    warnings.push(
      'Ordering link discovery is enabled but maxOrderingLinkLookups is 0, so no scans were performed.',
    );
  } else if (orderingLinkLookupsAttempted < restaurants.length) {
    warnings.push(
      `Ordering link scans were limited (${orderingLinkLookupsAttempted}/${restaurants.length}). Increase maxOrderingLinkLookups to scan more restaurants.`,
    );
  }

  const result: RestaurantDiscoveryResult = {
    input: request,
    geo: {
      lat: geoLat,
      lng: geoLng,
      formattedAddress,
    },
    restaurants,
    stats: {
      candidatesFromPlaces,
      afterFilters: restaurants.length,
      websiteLookupsAttempted,
      websiteLookupsSucceeded,
      orderingLinkLookupsAttempted,
      orderingLinkLookupsSucceeded,
    },
    warnings,
  };

  return createSuccess(result);
}
