import { Suspense } from "react";
import { PaymentView } from "@/components/payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { getActiveDiscount } from "@/actions/dining-discounts";
import { getRestaurantFees } from "@/actions/dine-in-restaurants";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { PostHogServerClient } from "@/lib/analytics/posthog/server";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function PaymentPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  const session = await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/payment`,
  });

  await PostHogServerClient.capture(session.userId, AnalyticsEvents.dineInPaymentViewed, {
    restaurant_guid: restaurantGuid,  
  });

  const [discountResult, feesResult] = await Promise.all([
    getActiveDiscount(),
    getRestaurantFees(restaurantGuid),
  ]);

  if(!discountResult.ok) {
    return <div>Error: {discountResult.message}</div>;
  }

  if(!feesResult.ok) {
    return <div>Error: {feesResult.message}</div>;
  }

  // here null means no active discount
  const discountPercentage = discountResult.data?.discountPercent ?? 0;
  const fees = feesResult.data;
  
  return (
    <div className="h-dvh bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <PaymentView
          restaurantGuid={restaurantGuid}
          initialDiscountPercentage={discountPercentage}
          deliveryFee={fees.deliveryFee}
          serviceFeePercent={fees.serviceFeePercent}
          showTips={fees.showTips}
        />
      </Suspense>
    </div>
  );
}

