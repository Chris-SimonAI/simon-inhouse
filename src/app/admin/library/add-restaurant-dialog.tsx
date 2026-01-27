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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AddRestaurantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a Toast URL");
      return;
    }

    setLoading(true);
    toast.info("Scraping menu... This may take a few minutes.");

    try {
      const response = await fetch("/api/bot/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success(`Added ${result.data.restaurant.name} to library!`);
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
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Restaurant to Library</DialogTitle>
            <DialogDescription>
              Enter a Toast restaurant URL to scrape the menu and add it to your library.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="url">Toast URL</Label>
            <Input
              id="url"
              placeholder="https://www.toasttab.com/restaurant-name"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="mt-2"
            />
            <p className="text-sm text-slate-500 mt-2">
              The restaurant will be added to your library. You can link it to hotels afterward.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scraping...
                </>
              ) : (
                "Add Restaurant"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
