import { Suspense } from "react";
import { PaymentView } from "@/components/payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";

type PageProps = {
  params: Promise<{
    hotelSlug: string;
    restaurantGuid: string;
  }>;
};

export default async function PaymentPage({ params }: PageProps) {
  const { hotelSlug, restaurantGuid } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/dine-in/restaurant/${restaurantGuid}/payment`,
  });

  return (
    <div className="h-dvh bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <PaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}

