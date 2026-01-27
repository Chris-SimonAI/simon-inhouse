import { getRestaurantById, getMenuForRestaurant } from "@/actions/admin-restaurants";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RescrapeMenuButton } from "./rescrape-menu-button";
import { MenuTable } from "./menu-table";

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ hotelId: string; restaurantId: string }>;
};

export default async function MenuPage({ params }: PageProps) {
  const { hotelId, restaurantId } = await params;

  const restaurantResult = await getRestaurantById(Number(restaurantId));
  if (!restaurantResult.ok) notFound();

  const restaurant = restaurantResult.data;
  const menuResult = await getMenuForRestaurant(restaurant.id);

  const { menu: _menu, groups } = menuResult.ok
    ? menuResult.data
    : { menu: null, groups: [] };

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link href={`/admin/hotels/${hotelId}/restaurants`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Restaurants
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">{restaurant.name}</h1>
          <p className="text-slate-500 mt-1">
            {groups.length} categories · {totalItems} items
          </p>
        </div>
        <RescrapeMenuButton
          restaurantId={restaurant.id}
          sourceUrl={(restaurant.metadata as { sourceUrl?: string } | null)?.sourceUrl}
        />
      </div>

      {groups.length > 0 ? (
        <MenuTable groups={groups} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <p className="text-lg font-medium text-slate-500">No menu found</p>
          <p className="text-slate-400 mt-1">Try re-scraping the menu using the button above.</p>
        </div>
      )}
    </div>
  );
}
