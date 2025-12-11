import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/menu-view";
import { getCompleteMenuByRestaurant } from "@/actions/menu";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { PostHogServerClient } from "@/lib/analytics/posthog/server";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function MenuPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  const session = await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/menu`,
  });

  await PostHogServerClient.capture(session.userId, AnalyticsEvents.dineInMenuViewed, {
    restaurant_guid: restaurantGuid, 
  });

  const result = await getCompleteMenuByRestaurant({ guid: restaurantGuid });

  if (!result.ok) {
    notFound();
  }

  return (
    <Suspense fallback={<div>Loading menu...</div>}>
      <MenuView menuData={result.data} restaurantGuid={restaurantGuid} />
    </Suspense>
  );
}

