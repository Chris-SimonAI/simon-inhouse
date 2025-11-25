import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { getActiveDiscount } from "@/actions/dining-discounts";

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

  const discountResult = await getActiveDiscount();

  if(!discountResult.ok) {
    return <div>Error: {discountResult.message}</div>;
  }

  // here null means no active discount
  const discountPercentage = discountResult.data?.discountPercent ?? 0;

  return (
    <div className="h-dvh bg-white ">
      <Suspense fallback={<div>Loading checkout...</div>}>
        <CheckoutView
          restaurantGuid={restaurantGuid}
          initialDiscountPercentage={discountPercentage}
        />
      </Suspense>
    </div>
  );
}

