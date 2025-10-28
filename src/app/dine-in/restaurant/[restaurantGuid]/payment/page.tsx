import { Suspense } from 'react';
import { PaymentView } from '@/components/payment-view.tsx';

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function PaymentPage({ params }: PageProps) {
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div>Loading payment...</div>}>
        <PaymentView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}
