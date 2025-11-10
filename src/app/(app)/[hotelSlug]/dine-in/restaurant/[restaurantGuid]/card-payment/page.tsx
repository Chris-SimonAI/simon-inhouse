import { Suspense } from "react";
import { CardPaymentView } from "@/components/card-payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function CardPaymentPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/card-payment`,
  });

  return (
    <div className="h-dvh bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <CardPaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}

