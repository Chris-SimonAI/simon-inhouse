'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  hotelId: number;
  restaurantGuid: string;
};

export function RescrapeMenuButton({ hotelId, restaurantGuid }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRescrape() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/scrape-restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_APP_API_KEY || "dummy",
        },
        body: JSON.stringify({
          hotelID: String(hotelId),
          restaurantMode: "existing",
          restaurantGuid: restaurantGuid,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Re-scraping menu... This may take a moment.");
        // Give time for the scraper to work
        setTimeout(() => router.refresh(), 15000);
      } else {
        toast.error(result.message || "Failed to start re-scraping");
      }
    } catch (error) {
      console.error("Rescrape error:", error);
      toast.error("Failed to start re-scraping");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleRescrape} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Re-scraping...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-scrape Menu
        </>
      )}
    </Button>
  );
}
