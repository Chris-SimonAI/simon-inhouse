import { getPlaceDetails } from "@/lib/places";
import { PlaceDetailsPage } from "@/components/place-details-page";
import { requireHotelSession } from "@/utils/require-hotel-session";

interface PageProps {
  params: Promise<{ hotelSlug: string; id: string }>;
}

export default async function AttractionsPage({ params }: PageProps) {
  const { hotelSlug, id } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/attractions/${id}`,
  });
  const placeDetails = await getPlaceDetails(id);

  return (
    <div className="h-dvh bg-white">
      <PlaceDetailsPage placeDetails={placeDetails} type="attraction" />
    </div>
  );
}

