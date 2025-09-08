import { getAmenityById } from "@/actions/amenities";
import { AmenityDetailsPage } from "@/components/AmenityDetailsPage";
import { DEFAULT_HOTEL_ID } from "@/constants";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttractionsPage({ params }: PageProps) {
  const { id } = await params;

  const idNumber = Number(id);

  if(Number.isNaN(idNumber)) {
    notFound();
  }

  const response = await getAmenityById(idNumber, DEFAULT_HOTEL_ID);

  if(!response.ok) {
    notFound();
  }

  const amenity = response.data;

  if(!amenity) {
    notFound();
  }

  return <AmenityDetailsPage amenity={amenity} />;
}
