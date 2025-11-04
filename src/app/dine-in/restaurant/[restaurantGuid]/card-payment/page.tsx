import { Suspense } from "react";
import { CardPaymentView } from "@/components/card-payment-view.tsx";
import { requireHotelSession } from "@/utils/require-hotel-session";

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function CardPaymentPage({ params }: PageProps) {
  await requireHotelSession();
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <CardPaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}
