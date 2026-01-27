import { getHotelById } from "@/actions/hotels";
import { getRestaurantsForHotel } from "@/actions/admin-restaurants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Utensils, DollarSign, Percent } from "lucide-react";
import { notFound } from "next/navigation";
import { ScrapeRestaurantButton } from "./scrape-restaurant-button";
import { ToggleRestaurantStatus } from "./toggle-restaurant-status";
import { DeleteRestaurantButton } from "./delete-restaurant-button";

type PageProps = {
  params: Promise<{ hotelSlug: string; hotelId: string }>;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "archived":
      return "destructive";
    default:
      return "secondary";
  }
}

export default async function RestaurantsPage({ params }: PageProps) {
  const { hotelSlug, hotelId } = await params;

  const hotelResult = await getHotelById(Number(hotelId));
  if (!hotelResult.ok) notFound();

  const hotel = hotelResult.data;
  const restaurantsResult = await getRestaurantsForHotel(hotel.id);
  const restaurants = restaurantsResult.ok ? restaurantsResult.data : [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href={`/${hotelSlug}/admin/hotels`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hotels
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{hotel.name}</h1>
          <p className="text-sm text-muted-foreground">{restaurants.length} restaurants</p>
        </div>
        <ScrapeRestaurantButton hotelId={hotel.id} />
      </div>

      <div className="grid gap-4">
        {restaurants.map((restaurant) => (
          <Card key={restaurant.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Utensils className="w-5 h-5" />
                    {restaurant.name}
                  </CardTitle>
                  <Badge variant={statusVariant(restaurant.status)}>
                    {restaurant.status}
                  </Badge>
                </div>
                {restaurant.cuisine && (
                  <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>
                )}
              </div>
              <div className="flex gap-2">
                <ToggleRestaurantStatus
                  restaurantId={restaurant.id}
                  currentStatus={restaurant.status}
                />
                <Button variant="outline" size="sm" asChild>
                  <Link href={`restaurants/${restaurant.id}/menu`}>View Menu</Link>
                </Button>
                <DeleteRestaurantButton
                  restaurantId={restaurant.id}
                  restaurantName={restaurant.name}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <DollarSign className="w-4 h-4" />
                    Delivery Fee
                  </div>
                  <div className="font-medium">${restaurant.deliveryFee}</div>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Percent className="w-4 h-4" />
                    Service Fee
                  </div>
                  <div className="font-medium">{restaurant.serviceFeePercent}%</div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Tips</div>
                  <div className="font-medium">{restaurant.showTips ? "Enabled" : "Disabled"}</div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Phone</div>
                  <div className="font-medium">{restaurant.phoneNumber || "Not set"}</div>
                </div>
              </div>

              {restaurant.description && (
                <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                  {restaurant.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {restaurants.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Utensils className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No restaurants yet</p>
            <p className="text-sm mt-1">Click "Add Restaurant" to scrape a menu from Toast</p>
          </div>
        )}
      </div>
    </main>
  );
}
