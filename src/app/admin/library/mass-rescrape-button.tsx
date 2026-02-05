'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

type Restaurant = {
  id: number;
  name: string;
  sourceUrl: string;
};

type Result = {
  restaurantId: number;
  restaurantName: string;
  ok: boolean;
  message?: string;
  itemCount?: number;
};

export function MassRescrapeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'scraping' | 'done'>('idle');

  async function handleOpen() {
    setOpen(true);
    setPhase('fetching');
    setResults([]);
    setCurrentIndex(0);

    try {
      const response = await fetch("/api/bot/mass-rescrape");
      const data = await response.json();

      if (data.ok) {
        setRestaurants(data.restaurants);
        setPhase('idle');
      } else {
        toast.error("Failed to fetch restaurants");
        setPhase('idle');
      }
    } catch (_error) {
      toast.error("Failed to fetch restaurants");
      setPhase('idle');
    }
  }

  async function handleStartRescrape() {
    if (restaurants.length === 0) {
      toast.error("No restaurants to rescrape");
      return;
    }

    setLoading(true);
    setPhase('scraping');
    setResults([]);
    setCurrentIndex(0);

    const newResults: Result[] = [];

    for (let i = 0; i < restaurants.length; i++) {
      setCurrentIndex(i);
      const restaurant = restaurants[i];

      try {
        const response = await fetch("/api/bot/mass-rescrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: restaurant.id }),
        });

        const result = await response.json();
        newResults.push({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          ok: result.ok,
          message: result.message,
          itemCount: result.itemCount,
        });
        setResults([...newResults]);
      } catch (error) {
        newResults.push({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          ok: false,
          message: "Network error",
        });
        setResults([...newResults]);
      }
    }

    setPhase('done');
    setLoading(false);

    const successCount = newResults.filter(r => r.ok).length;
    const failCount = newResults.filter(r => !r.ok).length;

    if (failCount === 0) {
      toast.success(`All ${successCount} restaurants rescraped successfully!`);
    } else if (successCount === 0) {
      toast.error(`All ${failCount} restaurants failed to rescrape`);
    } else {
      toast.warning(`${successCount} succeeded, ${failCount} failed`);
    }

    router.refresh();
  }

  function handleClose() {
    if (!loading) {
      setOpen(false);
      setPhase('idle');
      setResults([]);
      setRestaurants([]);
    }
  }

  const progress = restaurants.length > 0
    ? Math.round(((phase === 'done' ? restaurants.length : currentIndex) / restaurants.length) * 100)
    : 0;

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <RefreshCw className="w-4 h-4 mr-2" />
        Mass Rescrape
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mass Rescrape All Menus</DialogTitle>
            <DialogDescription>
              Re-scrape all restaurant menus from Toast to ensure they&apos;re up to date.
              This helps catch website changes before they affect orders.
            </DialogDescription>
          </DialogHeader>

          {phase === 'fetching' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="ml-3 text-slate-600">Loading restaurants...</span>
            </div>
          )}

          {phase === 'idle' && restaurants.length > 0 && (
            <div className="py-4">
              <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  This will rescrape <strong>{restaurants.length} restaurants</strong>.
                  Each takes 30-60 seconds. Total time: ~{Math.ceil(restaurants.length * 0.75)} minutes.
                </p>
              </div>
              <p className="text-sm text-slate-600">
                Restaurants to rescrape:
              </p>
              <ScrollArea className="h-48 mt-2 border rounded-lg p-3">
                <ul className="space-y-1">
                  {restaurants.map((r) => (
                    <li key={r.id} className="text-sm text-slate-700">
                      {r.name}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {phase === 'idle' && restaurants.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              No restaurants with source URLs found.
            </div>
          )}

          {(phase === 'scraping' || phase === 'done') && (
            <div className="py-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">
                    {phase === 'scraping'
                      ? `Scraping ${currentIndex + 1} of ${restaurants.length}...`
                      : `Completed ${restaurants.length} restaurants`
                    }
                  </span>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {phase === 'scraping' && restaurants[currentIndex] && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Scraping: {restaurants[currentIndex].name}
                  </span>
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm text-slate-600">Results:</span>
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {successCount} success
                    </span>
                    <span className="text-sm text-red-600 flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> {failCount} failed
                    </span>
                  </div>
                  <ScrollArea className="h-48 border rounded-lg">
                    <ul className="divide-y">
                      {results.map((r) => (
                        <li
                          key={r.restaurantId}
                          className={`px-3 py-2 text-sm flex items-center justify-between ${
                            r.ok ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {r.ok ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className={r.ok ? 'text-green-800' : 'text-red-800'}>
                              {r.restaurantName}
                            </span>
                          </div>
                          <span className={`text-xs ${r.ok ? 'text-green-600' : 'text-red-600'}`}>
                            {r.ok ? `${r.itemCount} items` : r.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              {phase === 'done' ? 'Close' : 'Cancel'}
            </Button>
            {phase === 'idle' && restaurants.length > 0 && (
              <Button onClick={handleStartRescrape} disabled={loading}>
                Start Rescrape
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
