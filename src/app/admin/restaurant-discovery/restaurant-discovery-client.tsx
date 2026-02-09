'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Compass, Copy, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { runRestaurantDiscovery } from '@/actions/restaurant-discovery';
import { cn } from '@/lib/utils';
import { type RestaurantDiscoveryResult } from '@/lib/restaurant-discovery/restaurant-discovery-types';

type DiscoveryRunState = 'idle' | 'loading' | 'done' | 'error';

export function RestaurantDiscoveryClient() {
  const [address, setAddress] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('7');
  const [minRating, setMinRating] = useState('4.2');
  const [minReviews, setMinReviews] = useState('50');
  const [maxResults, setMaxResults] = useState('30');
  const [fetchWebsites, setFetchWebsites] = useState(true);
  const [maxWebsiteLookups, setMaxWebsiteLookups] = useState('15');

  const [runState, setRunState] = useState<DiscoveryRunState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<RestaurantDiscoveryResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const [copied, setCopied] = useState(false);

  const parsedNumbers = useMemo(() => {
    const radius = Number(radiusMiles);
    const rating = Number(minRating);
    const reviews = Number(minReviews);
    const max = Number(maxResults);
    const maxLookups = Number(maxWebsiteLookups);

    return {
      radiusMiles: Number.isFinite(radius) ? radius : NaN,
      minRating: Number.isFinite(rating) ? rating : NaN,
      minReviews: Number.isFinite(reviews) ? reviews : NaN,
      maxResults: Number.isFinite(max) ? max : NaN,
      maxWebsiteLookups: Number.isFinite(maxLookups) ? maxLookups : NaN,
    };
  }, [maxResults, maxWebsiteLookups, minRating, minReviews, radiusMiles]);

  const formValid = useMemo(() => {
    if (address.trim().length < 5) {
      return false;
    }

    const numbers = parsedNumbers;
    if (!Number.isFinite(numbers.radiusMiles) || numbers.radiusMiles <= 0) {
      return false;
    }
    if (!Number.isFinite(numbers.minRating) || numbers.minRating < 0) {
      return false;
    }
    if (!Number.isFinite(numbers.minReviews) || numbers.minReviews < 0) {
      return false;
    }
    if (
      !Number.isFinite(numbers.maxResults) ||
      numbers.maxResults <= 0 ||
      numbers.maxResults > 60
    ) {
      return false;
    }
    if (
      !Number.isFinite(numbers.maxWebsiteLookups) ||
      numbers.maxWebsiteLookups < 0
    ) {
      return false;
    }

    return true;
  }, [address, parsedNumbers]);

  function handleRun() {
    if (!formValid || isPending) {
      return;
    }

    setRunState('loading');
    setErrorMessage(null);
    setData(null);

    const payload = {
      address: address.trim(),
      radiusMiles: parsedNumbers.radiusMiles,
      minRating: parsedNumbers.minRating,
      minReviews: Math.trunc(parsedNumbers.minReviews),
      maxResults: Math.trunc(parsedNumbers.maxResults),
      fetchWebsites,
      maxWebsiteLookups: Math.trunc(parsedNumbers.maxWebsiteLookups),
    };

    startTransition(async () => {
      const result = await runRestaurantDiscovery(payload);
      if (!result.ok) {
        setRunState('error');
        setErrorMessage(result.message);
        return;
      }

      setRunState('done');
      setData(result.data);
    });
  }

  async function handleCopyJson() {
    if (!data) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Best-effort; no-op.
    }
  }

  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Compass className="h-5 w-5 text-slate-700" />
            Restaurant Discovery
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-[70ch]">
            Enter a hotel address and discover nearby restaurants. Filter by Google rating and
            review count, and optionally classify ordering platforms (Toast, ChowNow, Slice, etc.).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <Button variant="outline" onClick={handleCopyJson}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </>
              )}
            </Button>
          ) : null}
          <Button onClick={handleRun} disabled={!formValid || isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Find Restaurants
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Hotel address</Label>
              <Input
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="e.g., 2401 Broadway, Santa Monica, CA"
              />
              <p className="text-xs text-slate-500">
                Uses Google Geocoding + Places. Requires `GOOGLE_PLACES_API_KEY` on the server.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="radiusMiles">Radius (miles)</Label>
                <Input
                  id="radiusMiles"
                  inputMode="decimal"
                  value={radiusMiles}
                  onChange={(event) => setRadiusMiles(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxResults">Max results</Label>
                <Input
                  id="maxResults"
                  inputMode="numeric"
                  value={maxResults}
                  onChange={(event) => setMaxResults(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minRating">Min rating</Label>
                <Input
                  id="minRating"
                  inputMode="decimal"
                  value={minRating}
                  onChange={(event) => setMinRating(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minReviews">Min reviews</Label>
                <Input
                  id="minReviews"
                  inputMode="numeric"
                  value={minReviews}
                  onChange={(event) => setMinReviews(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="fetchWebsites">Fetch websites + platform signals</Label>
                  <p className="text-xs text-slate-500">
                    Slower and additional API calls, but enables provider classification.
                  </p>
                </div>
                <Switch
                  id="fetchWebsites"
                  checked={fetchWebsites}
                  onCheckedChange={setFetchWebsites}
                />
              </div>
              <div className={cn('space-y-2', !fetchWebsites && 'opacity-50')}>
                <Label htmlFor="maxWebsiteLookups">Max website lookups</Label>
                <Input
                  id="maxWebsiteLookups"
                  inputMode="numeric"
                  value={maxWebsiteLookups}
                  onChange={(event) => setMaxWebsiteLookups(event.target.value)}
                  disabled={!fetchWebsites}
                />
              </div>
            </div>

            {runState === 'error' && errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-h-[540px]">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Results</CardTitle>
            {data ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {data.stats.afterFilters}/{data.stats.candidatesFromPlaces} after filters
                </span>
                <span>•</span>
                <span>
                  Website lookups {data.stats.websiteLookupsSucceeded}/{data.stats.websiteLookupsAttempted}
                </span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="h-[480px]">
            {runState === 'idle' ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Run a search to see restaurants near the hotel.
              </div>
            ) : null}

            {runState === 'loading' ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-600">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Querying Google Places...
              </div>
            ) : null}

            {runState === 'done' && data ? (
              <div className="h-full flex flex-col gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">
                    Center: {data.geo.formattedAddress ?? data.input.address}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Radius: {data.input.radiusMiles} mi | Min rating: {data.input.minRating} | Min reviews:{' '}
                    {data.input.minReviews}
                  </div>
                  {data.warnings.length > 0 ? (
                    <ul className="mt-2 text-xs text-amber-700 list-disc pl-5 space-y-1">
                      {data.warnings.slice(0, 3).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <ScrollArea className="flex-1 rounded-xl border border-slate-200 bg-white">
                  <div className="divide-y divide-slate-200">
                    {data.restaurants.map((restaurant) => (
                      <div key={restaurant.placeId} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <a
                              href={restaurant.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-slate-900 hover:underline"
                            >
                              {restaurant.name}
                            </a>
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {restaurant.address ?? 'No address returned'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {restaurant.rating ?? 'N/A'}⭐
                              </Badge>
                              <Badge variant="outline" className="text-slate-600">
                                {restaurant.userRatingsTotal ?? 'N/A'} reviews
                              </Badge>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-slate-700',
                                restaurant.orderingPlatform.id === 'toast' &&
                                  'border-emerald-200 bg-emerald-50 text-emerald-800',
                                restaurant.orderingPlatform.id === 'chownow' &&
                                  'border-blue-200 bg-blue-50 text-blue-800',
                                restaurant.orderingPlatform.id === 'slice' &&
                                  'border-orange-200 bg-orange-50 text-orange-800',
                              )}
                              title={restaurant.orderingPlatform.reason}
                            >
                              {restaurant.orderingPlatform.label} ({restaurant.orderingPlatform.confidence})
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-medium">Website:</span>
                          {restaurant.websiteUrl ? (
                            <a
                              href={restaurant.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate max-w-[70ch] hover:underline"
                            >
                              {restaurant.websiteHost ?? restaurant.websiteUrl}
                            </a>
                          ) : (
                            <span className="text-slate-400">Not fetched</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {data.restaurants.length === 0 ? (
                      <div className="p-6 text-sm text-slate-500">
                        No restaurants matched the filters.
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

