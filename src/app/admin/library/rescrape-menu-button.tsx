'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  restaurantId: number;
  sourceUrl?: string;
};

export function RescrapeMenuButton({ restaurantId, sourceUrl }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRescrape() {
    if (!sourceUrl) {
      toast.error("No source URL found for this restaurant");
      return;
    }

    setLoading(true);
    toast.info("Re-scraping menu... This may take a few minutes.");

    try {
      const response = await fetch("/api/bot/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: sourceUrl,
          restaurantId: restaurantId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Menu re-scraped successfully!");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to re-scrape menu");
      }
    } catch (error) {
      console.error("Rescrape error:", error);
      toast.error("Failed to re-scrape menu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRescrape}
      disabled={loading || !sourceUrl}
      title={!sourceUrl ? "No source URL available" : "Re-scrape menu from Toast"}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          Scraping...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-1" />
          Rescrape
        </>
      )}
    </Button>
  );
}
