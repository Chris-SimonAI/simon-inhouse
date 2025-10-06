import { getAmenityById } from "@/actions/amenities";
import { AmenityDetailsPage } from "@/components/AmenityDetailsPage";
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

  const response = await getAmenityById(idNumber);

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
