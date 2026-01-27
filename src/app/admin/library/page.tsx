import { getRestaurantLibrary } from "@/actions/restaurant-library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Utensils, MapPin, Building2, Menu } from "lucide-react";
import { LinkRestaurantButton } from "./link-restaurant-button";
import { ToggleRestaurantStatus } from "./toggle-restaurant-status";
import { RescrapeMenuButton } from "./rescrape-menu-button";
import { AddRestaurantDialog } from "./add-restaurant-dialog";
import { CheckStatusButton } from "./check-status-button";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const result = await getRestaurantLibrary();
  const restaurants = result.ok ? result.data : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Restaurant Library</h1>
          <p className="text-slate-500 mt-1">
            {restaurants.length} restaurants · Link restaurants to multiple hotels
          </p>
        </div>
        <AddRestaurantDialog />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Restaurant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Location</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Linked Hotels</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {restaurants.map((restaurant) => (
              <tr key={restaurant.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {restaurant.imageUrls && restaurant.imageUrls.length > 0 ? (
                      <img
                        src={restaurant.imageUrls[0]}
                        alt={restaurant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Utensils className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{restaurant.name}</div>
                      {restaurant.cuisine && (
                        <div className="text-sm text-slate-500">{restaurant.cuisine}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {restaurant.city ? (
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>{restaurant.city}, {restaurant.state}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">No location</span>
                  )}
                  {(restaurant.metadata as { deliveryEta?: string } | null)?.deliveryEta && (
                    <div className="text-xs text-blue-600 mt-1">
                      Delivery: {(restaurant.metadata as { deliveryEta?: string }).deliveryEta}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant={
                      restaurant.status === "approved"
                        ? "default"
                        : restaurant.status === "pending"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {restaurant.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {restaurant.originalHotel && (
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="w-3 h-3 text-blue-500" />
                        <span className="text-slate-700">{restaurant.originalHotel.hotelName}</span>
                        <Badge variant="outline" className="text-xs ml-1">Original</Badge>
                      </div>
                    )}
                    {restaurant.linkedHotels.map((link) => (
                      <div key={link.hotelId} className="flex items-center gap-1 text-sm">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{link.hotelName}</span>
                        {link.distanceMiles && (
                          <span className="text-xs text-slate-400">
                            ({parseFloat(link.distanceMiles).toFixed(1)} mi)
                          </span>
                        )}
                      </div>
                    ))}
                    {!restaurant.originalHotel && restaurant.linkedHotels.length === 0 && (
                      <span className="text-slate-400 text-sm">No hotels linked</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <CheckStatusButton
                      restaurantId={restaurant.id}
                      restaurantName={restaurant.name}
                    />
                    <ToggleRestaurantStatus
                      restaurantId={restaurant.id}
                      currentStatus={restaurant.status}
                    />
                    <RescrapeMenuButton
                      restaurantId={restaurant.id}
                      sourceUrl={(restaurant.metadata as { sourceUrl?: string } | null)?.sourceUrl}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/library/${restaurant.id}/menu`}>
                        <Menu className="w-4 h-4 mr-1" />
                        Menu
                      </Link>
                    </Button>
                    <LinkRestaurantButton
                      restaurantId={restaurant.id}
                      restaurantName={restaurant.name}
                      existingHotelIds={[
                        restaurant.originalHotel?.hotelId,
                        ...restaurant.linkedHotels.map(l => l.hotelId)
                      ].filter(Boolean) as number[]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {restaurants.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Utensils className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No restaurants in library</p>
            <p className="mt-1">Add restaurants by scraping from Toast in the Hotels section.</p>
          </div>
        )}
      </div>
    </div>
  );
}
