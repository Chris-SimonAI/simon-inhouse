import { getAmenityById } from "@/actions/amenities";
import { AmenityDetailsPage } from "@/components/amenity-details-page";
import { requireHotelSession } from "@/utils/require-hotel-session";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ hotelSlug: string; id: string }>;
}

export default async function AmenityDetails({ params }: PageProps) {
  const { hotelSlug, id } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/amenities/${id}`,
  });

  const idNumber = Number(id);
  if (Number.isNaN(idNumber)) {
    notFound();
  }

  const response = await getAmenityById(idNumber);
  if (!response.ok || !response.data) {
    notFound();
  }

  return (
    <div className="h-dvh bg-white">
      <AmenityDetailsPage amenity={response.data} />
    </div>
  );
}

