import { DineInRestaurantPage as DineInRestaurantComponent } from "@/components/dine-in-restaurant-page";
import { getDineInRestaurantByGuid } from "@/actions/dine-in-restaurants";
import { notFound } from "next/navigation";
import { requireHotelSession } from "@/utils/require-hotel-session";

interface PageProps {
  params: Promise<{ hotelSlug: string; restaurantGuid: string }>;
}

export default async function Page({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/details`,
  });
  const response = await getDineInRestaurantByGuid(restaurantGuid);

  if (!response.ok) {
    notFound();
  }

  const dineInRestaurant = response.data;

  if (!dineInRestaurant) {
    notFound();
  }

  return (
    <div className="h-dvh bg-white ">
      <DineInRestaurantComponent {...dineInRestaurant} />
    </div>
  );
}
