import { Suspense } from 'react';
import { CheckoutView } from '@/components/checkout-view';

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white ">
      <Suspense fallback={<div>Loading checkout...</div>}>
        <CheckoutView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}

