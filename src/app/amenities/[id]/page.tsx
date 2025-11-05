import { getAmenityById } from "@/actions/amenities";
import { AmenityDetailsPage } from "@/components/amenity-details-page";
import { notFound } from "next/navigation";
import { requireHotelSession } from "@/utils/require-hotel-session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AmenityDetails({ params }: PageProps) {
  await requireHotelSession();

  const { id } = await params;
  const idNumber = Number(id);
  if (Number.isNaN(idNumber)) {
    notFound();
  }

  const response = await getAmenityById(idNumber);
  if (!response.ok || !response.data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <AmenityDetailsPage amenity={response.data} />
    </div>
  );
}
