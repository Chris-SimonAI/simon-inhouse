import { getHotelById } from "@/actions/hotels";
import { HotelForm } from "../../hotel-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ hotelId: string }>;
};

export default async function EditHotelPage({ params }: PageProps) {
  const { hotelId } = await params;

  const result = await getHotelById(Number(hotelId));
  if (!result.ok) {
    notFound();
  }

  const hotel = result.data;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="../../hotels">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hotels
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Edit Hotel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update details for {hotel.name}
        </p>
      </div>

      <HotelForm hotel={hotel} />
    </main>
  );
}
