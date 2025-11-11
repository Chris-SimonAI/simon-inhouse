import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";
import { requireHotelSession } from "@/utils/require-hotel-session";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/checkout`,
  });

  return (
    <div className="h-dvh bg-white ">
      <Suspense fallback={<div>Loading checkout...</div>}>
        <CheckoutView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}

