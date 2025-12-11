import { Suspense } from "react";
import { CardPaymentView } from "@/components/card-payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { PostHogServerClient } from "@/lib/analytics/posthog/server";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function CardPaymentPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  const session = await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/card-payment`,
  });

  await PostHogServerClient.capture(session.userId, AnalyticsEvents.dineInCardPaymentViewed, {
    restaurant_guid: restaurantGuid,  
  });

  return (
    <div className="h-dvh bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <CardPaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}

