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
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createHotel } from "@/actions/hotels";

interface ScrapedHotel {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  slug: string;
}

export function AddHotelDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ScrapedHotel | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a hotel website URL");
      return;
    }

    setScraping(true);
    setPreview(null);

    try {
      const response = await fetch("/api/bot/scrape-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const result = await response.json();

      if (result.ok) {
        setPreview(result.data);
        toast.success("Hotel info scraped successfully");
      } else {
        toast.error(result.message || "Failed to scrape hotel info");
      }
    } catch (error) {
      console.error("Scrape error:", error);
      toast.error("Failed to scrape hotel info");
    } finally {
      setScraping(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;

    setSaving(true);

    try {
      const result = await createHotel({
        name: preview.name,
        slug: preview.slug,
        address: preview.address,
        latitude: preview.latitude.toString(),
        longitude: preview.longitude.toString(),
      });

      if (result.ok) {
        toast.success(`Created hotel "${preview.name}"`);
        setOpen(false);
        setUrl("");
        setPreview(null);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to create hotel");
      }
    } catch (error) {
      console.error("Create hotel error:", error);
      toast.error("Failed to create hotel");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setUrl("");
      setPreview(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Globe className="w-4 h-4 mr-2" />
          Add from URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Hotel from Website</DialogTitle>
          <DialogDescription>
            Enter a hotel website URL to automatically scrape the name, address, and coordinates.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <form onSubmit={handleScrape}>
            <div className="py-4">
              <Label htmlFor="hotel-url">Hotel Website URL</Label>
              <Input
                id="hotel-url"
                placeholder="https://www.example-hotel.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={scraping}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                The hotel name, address, and coordinates will be scraped from the website.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={scraping}>
                Cancel
              </Button>
              <Button type="submit" disabled={scraping || !url.trim()}>
                {scraping ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  "Scrape Hotel"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <div className="py-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={preview.name}
                  onChange={(e) => setPreview({ ...preview, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={preview.slug}
                  onChange={(e) => setPreview({ ...preview, slug: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={preview.address}
                  onChange={(e) => setPreview({ ...preview, address: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    value={preview.latitude}
                    onChange={(e) => setPreview({ ...preview, latitude: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    value={preview.longitude}
                    onChange={(e) => setPreview({ ...preview, longitude: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={saving}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Hotel"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
