import { getAllHotels } from "@/actions/hotels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus, Building2, MapPin, CreditCard } from "lucide-react";
import { DeleteHotelButton } from "./delete-hotel-button";
import { AddHotelDialog } from "./add-hotel-dialog";

export const dynamic = 'force-dynamic';

export default async function HotelsPage() {
  const result = await getAllHotels();
  const hotels = result.ok ? result.data! : [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hotels / Locations</h1>
          <p className="text-sm text-muted-foreground">{hotels.length} total</p>
        </div>
        <div className="flex gap-2">
          <AddHotelDialog />
          <Button asChild>
            <Link href="hotels/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Hotel
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {hotels.map((hotel) => (
          <Card key={hotel.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {hotel.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">/{hotel.slug}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`hotels/${hotel.id}/edit`}>Edit</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`hotels/${hotel.id}/restaurants`}>Restaurants</Link>
                </Button>
                <DeleteHotelButton hotelId={hotel.id} hotelName={hotel.name} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  Address
                </div>
                <div>{hotel.address || "Not set"}</div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  Coordinates
                </div>
                <div>{hotel.latitude}, {hotel.longitude}</div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="w-4 h-4" />
                  Stripe Account
                </div>
                <div>{hotel.stripeAccountId || "Not connected"}</div>

                <div className="text-muted-foreground">Discount</div>
                <div>{hotel.restaurantDiscount}%</div>
              </div>
            </CardContent>
          </Card>
        ))}

        {hotels.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No hotels yet. Click &quot;Add Hotel&quot; to create one.
          </div>
        )}
      </div>
    </main>
  );
}
