import { requireHotelSession } from "@/utils/require-hotel-session";
import { TipStaffScreen } from "@/components/tip-staff-screen";

interface PageProps {
  params: Promise<{ hotelSlug: string }>;
}

export default async function TipStaffPage({ params }: PageProps) {
  const { hotelSlug } = await params;
  const { hotel } = await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/tip-staff`,
  });

  return <TipStaffScreen onBack={() => window.history.back()} hotelId={hotel.id} hotelName={hotel.name} dynamicMessage="We appreciate your generosity in tipping the team. Our service team is critical to making your stay at our hotel the best it can be." />;
}

