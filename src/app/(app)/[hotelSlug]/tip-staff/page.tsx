import { requireHotelSession } from "@/utils/require-hotel-session";
import { TipStaffScreen } from "@/components/tip-staff-screen";
import { PostHogServerClient } from "@/lib/analytics/posthog/server";
import { AnalyticsEvents } from "@/lib/analytics/events";

interface PageProps {
  params: Promise<{ hotelSlug: string }>;
}

export default async function TipStaffPage({ params }: PageProps) {
  const { hotelSlug } = await params;
  const { hotel, userId } = await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/tip-staff`,
  });

  await PostHogServerClient.capture(userId, AnalyticsEvents.tipStaffPageViewed);

  return <TipStaffScreen hotelId={hotel.id} hotelName={hotel.name} dynamicMessage="We appreciate your generosity in tipping the team. Our service team is critical to making your stay at our hotel the best it can be." />;
}

