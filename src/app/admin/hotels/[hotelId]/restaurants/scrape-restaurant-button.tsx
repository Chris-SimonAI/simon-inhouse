'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  hotelId: number;
};

export function ScrapeRestaurantButton({ hotelId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  async function handleScrape() {
    if (!url.trim()) {
      toast.error("Please enter a Toast URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setLoading(true);

    try {
      // Use our local Playwright scraper instead of SQS/Lambda
      const response = await fetch("/api/bot/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          hotelId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success(`Added "${result.data.restaurant.name}" with ${result.data.menu.itemCount} menu items!`);
        setOpen(false);
        setUrl("");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to scrape menu");
      }
    } catch (error) {
      console.error("Scrape error:", error);
      toast.error("Failed to scrape menu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Restaurant from Toast</DialogTitle>
          <DialogDescription>
            Enter the Toast online ordering URL for the restaurant. We&apos;ll scrape the menu automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="toast-url">Toast Ordering URL</Label>
            <Input
              id="toast-url"
              placeholder="https://www.toasttab.com/restaurant-name"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Paste the full Toast ordering URL for the restaurant
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleScrape} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scraping menu...
                </>
              ) : (
                "Add Restaurant"
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
