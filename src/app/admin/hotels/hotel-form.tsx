'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHotel, updateHotel } from "@/actions/hotels";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Hotel } from "@/db/schemas/hotels";
import { AddressInput } from "./address-input";

type HotelFormProps = {
  hotel?: Hotel;
};

export function HotelForm({ hotel }: HotelFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [latitude, setLatitude] = useState<string>(hotel?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState<string>(hotel?.longitude?.toString() || "");
  const [address, setAddress] = useState<string>(hotel?.address || "");
  const isEdit = !!hotel;

  function handlePlaceSelect(place: { address: string; latitude: number; longitude: number }) {
    setAddress(place.address);
    setLatitude(place.latitude.toString());
    setLongitude(place.longitude.toString());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      slug: (formData.get("slug") as string).toLowerCase().trim(),
      address: address || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      stripeAccountId: (formData.get("stripeAccountId") as string) || undefined,
      restaurantDiscount: parseFloat(formData.get("restaurantDiscount") as string) || 20,
    };

    const result = isEdit
      ? await updateHotel(hotel.id, data)
      : await createHotel(data);

    setLoading(false);

    if (result.ok) {
      toast.success(isEdit ? "Hotel updated" : "Hotel created");
      router.push("/admin/hotels");
      router.refresh();
    } else {
      toast.error(result.message || "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Hotel Name *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={hotel?.name}
          required
          placeholder="The Grand Hotel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug *</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">/</span>
          <Input
            id="slug"
            name="slug"
            defaultValue={hotel?.slug}
            required
            placeholder="grand-hotel"
            pattern="[a-z0-9-]+"
            className="lowercase"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only. This is the URL guests will use.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <AddressInput
          defaultValue={hotel?.address || ""}
          onPlaceSelect={handlePlaceSelect}
          onChange={setAddress}
        />
        <p className="text-xs text-muted-foreground">
          Start typing to search for an address. Coordinates will be filled automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude {!isEdit && "*"}</Label>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            required={!isEdit}
            placeholder="34.0522"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude {!isEdit && "*"}</Label>
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            required={!isEdit}
            placeholder="-118.2437"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stripeAccountId">Stripe Account ID</Label>
        <Input
          id="stripeAccountId"
          name="stripeAccountId"
          defaultValue={hotel?.stripeAccountId || ""}
          placeholder="acct_1234567890"
        />
        <p className="text-xs text-muted-foreground">
          Connect a Stripe account to accept payments for this hotel.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="restaurantDiscount">Restaurant Discount (%)</Label>
        <Input
          id="restaurantDiscount"
          name="restaurantDiscount"
          type="number"
          defaultValue={hotel?.restaurantDiscount || 20}
          min="0"
          max="100"
        />
        <p className="text-xs text-muted-foreground">
          Percentage discount applied to restaurant orders at this hotel.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEdit ? "Updating..." : "Creating..."}
            </>
          ) : (
            isEdit ? "Update Hotel" : "Create Hotel"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
