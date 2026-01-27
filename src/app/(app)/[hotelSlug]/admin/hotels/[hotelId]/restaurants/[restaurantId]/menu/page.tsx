import { getRestaurantById, getMenuForRestaurant } from "@/actions/admin-restaurants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed, ImageOff } from "lucide-react";
import { RescrapeMenuButton } from "./rescrape-menu-button";

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ hotelSlug: string; hotelId: string; restaurantId: string }>;
};

export default async function MenuPage({ params }: PageProps) {
  const { hotelSlug, hotelId, restaurantId } = await params;

  const restaurantResult = await getRestaurantById(Number(restaurantId));
  if (!restaurantResult.ok) notFound();

  const restaurant = restaurantResult.data;
  const menuResult = await getMenuForRestaurant(restaurant.id);

  const { menu, groups } = menuResult.ok
    ? menuResult.data
    : { menu: null, groups: [] };

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href={`/${hotelSlug}/admin/hotels/${hotelId}/restaurants`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Restaurants
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">
            {menu ? (
              <>
                {groups.length} categories · {totalItems} items
                {menu.status && (
                  <Badge variant={menu.status === "approved" ? "default" : "secondary"} className="ml-2">
                    {menu.status}
                  </Badge>
                )}
              </>
            ) : (
              "No menu found"
            )}
          </p>
        </div>
        <RescrapeMenuButton
          hotelId={Number(hotelId)}
          restaurantGuid={restaurant.restaurantGuid}
        />
      </div>

      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      {/* Item image */}
                      {item.imageUrls && item.imageUrls.length > 0 ? (
                        <img
                          src={item.imageUrls[0]}
                          alt={item.name}
                          className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <ImageOff className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium">{item.name}</h4>
                            {item.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-medium">${item.price}</div>
                            {!item.isAvailable && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Out of Stock
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Modifiers info */}
                        {item.modifierGroupsReferences && item.modifierGroupsReferences.length > 0 && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {item.modifierGroupsReferences.length} modifier group{item.modifierGroupsReferences.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {group.items.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">
                      No items in this category
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">No menu found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try re-scraping the menu using the button above
          </p>
        </div>
      )}
    </main>
  );
}
