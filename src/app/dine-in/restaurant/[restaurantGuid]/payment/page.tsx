import { Suspense } from 'react';
import { PaymentView } from '@/components/payment-view.tsx';
import { requireHotelSession } from '@/utils/require-hotel-session';

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function PaymentPage({ params }: PageProps) {
  await requireHotelSession();
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <PaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}
