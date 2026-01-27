import { getHotelById } from "@/actions/hotels";
import { getRestaurantsForHotel } from "@/actions/admin-restaurants";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ScrapeRestaurantButton } from "./scrape-restaurant-button";
import { ToggleRestaurantStatus } from "./toggle-restaurant-status";
import { DeleteRestaurantButton } from "./delete-restaurant-button";

type PageProps = {
  params: Promise<{ hotelId: string }>;
};

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "archived":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default async function RestaurantsPage({ params }: PageProps) {
  const { hotelId } = await params;

  const hotelResult = await getHotelById(Number(hotelId));
  if (!hotelResult.ok) notFound();

  const hotel = hotelResult.data;
  const restaurantsResult = await getRestaurantsForHotel(hotel.id);
  const restaurants = restaurantsResult.ok ? restaurantsResult.data : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link href="/admin/hotels">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hotels
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">{hotel.name}</h1>
          <p className="text-slate-500 mt-1">{restaurants.length} restaurants</p>
        </div>
        <ScrapeRestaurantButton hotelId={hotel.id} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Restaurant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Delivery Fee</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Service Fee</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tips</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {restaurants.map((restaurant) => (
              <tr key={restaurant.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{restaurant.name}</div>
                  {restaurant.cuisine && (
                    <div className="text-sm text-slate-500">{restaurant.cuisine}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(restaurant.status)}`}>
                    {restaurant.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  ${restaurant.deliveryFee}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {restaurant.serviceFeePercent}%
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {restaurant.showTips ? "Yes" : "No"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <ToggleRestaurantStatus
                      restaurantId={restaurant.id}
                      currentStatus={restaurant.status}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/hotels/${hotelId}/restaurants/${restaurant.id}/menu`}>
                        Menu
                      </Link>
                    </Button>
                    <DeleteRestaurantButton
                      restaurantId={restaurant.id}
                      restaurantName={restaurant.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {restaurants.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg font-medium">No restaurants yet</p>
            <p className="mt-1">Click "Add Restaurant" to scrape a menu from Toast.</p>
          </div>
        )}
      </div>
    </div>
  );
}
