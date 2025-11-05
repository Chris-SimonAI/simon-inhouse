import { DineInRestaurantPage as DineInRestaurantComponent } from "@/components/dine-in-restaurant-page";
import { getDineInRestaurantByGuid } from "@/actions/dine-in-restaurants";
import { notFound } from "next/navigation";
import { requireHotelSession } from "@/utils/require-hotel-session";

interface PageProps {
  params: Promise<{ restaurantGuid: string }>;
}

export default async function Page({ params }: PageProps) {
  await requireHotelSession();
  const { restaurantGuid } = await params;
  const response = await getDineInRestaurantByGuid(restaurantGuid); 

  if (!response.ok) {
    notFound();
  }

  const dineInRestaurant = response.data;

  if (!dineInRestaurant) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white ">
      <DineInRestaurantComponent {...dineInRestaurant} />
    </div>
  );
}
