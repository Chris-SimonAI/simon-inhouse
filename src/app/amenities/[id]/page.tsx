import { getAmenityById } from "@/actions/amenities";
import { AmenityDetailsPage } from "@/components/AmenityDetailsPage";
import { DEFAULT_HOTEL_ID } from "@/constants";
import { getHotelSession } from "@/actions/sessions";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttractionsPage({ params }: PageProps) {
  const { id } = await params;

  const idNumber = Number(id);

  if (Number.isNaN(idNumber)) {
    notFound();
  }

  // Get hotel ID from current session, fallback to DEFAULT_HOTEL_ID
  const sessionResult = await getHotelSession();
  const hotelId = sessionResult.ok && sessionResult.data 
    ? parseInt(sessionResult.data.qrData.hotelId) 
    : DEFAULT_HOTEL_ID;

  const response = await getAmenityById(idNumber, hotelId);

  if (!response.ok) {
    notFound();
  }

  const amenity = response.data;

  if (!amenity) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <AmenityDetailsPage amenity={amenity} />
    </div>
  )
}
