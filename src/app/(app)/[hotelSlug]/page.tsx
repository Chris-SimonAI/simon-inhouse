import { requireHotelSession } from "@/utils/require-hotel-session";
import { getDineInRestaurantsByHotelId } from "@/actions/dine-in-restaurants";
import OrderSuccessToast from "@/components/order-success-toast";
import { RestaurantListView } from "@/components/restaurant-list-view";

interface PageProps {
  params: Promise<{ hotelSlug: string }>;
}

export default async function HotelHomePage({ params }: PageProps) {
  const resolvedParams = await params;
  const { hotel } = await requireHotelSession({
    hotelSlug: resolvedParams.hotelSlug,
    redirectTo: `/${resolvedParams.hotelSlug}`,
  });

  const restaurantsResult = await getDineInRestaurantsByHotelId();
  const restaurants = restaurantsResult.ok ? restaurantsResult.data : [];

  return (
    <main className="h-dvh w-full bg-gray-50">
      <OrderSuccessToast />
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md">
          <RestaurantListView hotel={hotel} restaurants={restaurants} />
        </div>
      </div>
    </main>
  );
}
