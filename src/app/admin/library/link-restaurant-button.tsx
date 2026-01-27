'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getAllHotelsForLinking, linkRestaurantToHotel } from "@/actions/restaurant-library";

type Hotel = {
  id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
};

type LinkRestaurantButtonProps = {
  restaurantId: number;
  restaurantName: string;
  existingHotelIds: number[];
};

export function LinkRestaurantButton({
  restaurantId,
  restaurantName,
  existingHotelIds,
}: LinkRestaurantButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);

  useEffect(() => {
    if (open) {
      loadHotels();
    }
  }, [open]);

  async function loadHotels() {
    setLoading(true);
    const result = await getAllHotelsForLinking();
    if (result.ok) {
      // Filter out hotels that are already linked
      setHotels(result.data.filter(h => !existingHotelIds.includes(h.id)));
    }
    setLoading(false);
  }

  async function handleLink(hotelId: number) {
    setLinking(true);
    const result = await linkRestaurantToHotel(restaurantId, hotelId);
    if (result.ok) {
      toast.success("Restaurant linked to hotel");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
    setLinking(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 className="w-4 h-4 mr-2" />
        Link to Hotel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Restaurant to Hotel</DialogTitle>
            <DialogDescription>
              Add &quot;{restaurantName}&quot; to another hotel. Only hotels within delivery distance will be available.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : hotels.length > 0 ? (
              <div className="space-y-2">
                <Label>Available Hotels</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {hotels.map((hotel) => (
                    <button
                      key={hotel.id}
                      onClick={() => handleLink(hotel.id)}
                      disabled={linking}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium">{hotel.name}</div>
                          {hotel.latitude && hotel.longitude ? (
                            <div className="text-xs text-green-600">Has coordinates</div>
                          ) : (
                            <div className="text-xs text-amber-600">No coordinates</div>
                          )}
                        </div>
                      </div>
                      {linking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No available hotels to link.</p>
                <p className="text-sm mt-1">All hotels are already linked to this restaurant.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
