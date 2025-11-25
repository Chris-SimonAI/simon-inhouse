import { Suspense } from "react";
import { PaymentView } from "@/components/payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { getActiveDiscount } from "@/actions/dining-discounts";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function PaymentPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/payment`,
  });

  const discountResult = await getActiveDiscount();

  if(!discountResult.ok) {
    return <div>Error: {discountResult.message}</div>;
  }

  // here null means no active discount
  const discountPercentage = discountResult.data?.discountPercent ?? 0;
  
  return (
    <div className="h-dvh bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <PaymentView
          restaurantGuid={restaurantGuid}
          initialDiscountPercentage={discountPercentage}
        />
      </Suspense>
    </div>
  );
}

