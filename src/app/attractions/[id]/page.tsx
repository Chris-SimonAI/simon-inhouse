import { getPlaceDetails } from "@/lib/places";
import { PlaceDetailsPage } from "@/components/PlaceDetailsPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttractionsPage({ params }: PageProps) {
  const { id } = await params;
  const placeDetails = await getPlaceDetails(id);

  return <PlaceDetailsPage placeDetails={placeDetails} type="attraction" />;
}
