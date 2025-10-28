import { Suspense } from "react";
import { CardPaymentView } from "@/components/card-payment-view.tsx";

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function CardPaymentPage({ params }: PageProps) {
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <CardPaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}
