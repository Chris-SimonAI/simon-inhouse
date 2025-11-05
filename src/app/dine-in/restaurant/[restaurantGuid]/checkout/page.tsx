import { Suspense } from 'react';
import { CheckoutView } from '@/components/checkout-view';
import { requireHotelSession } from '@/utils/require-hotel-session';

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  await requireHotelSession();
  const { restaurantGuid } = await params;

  return (
    <div className="min-h-screen bg-white ">
      <Suspense fallback={<div>Loading checkout...</div>}>
        <CheckoutView restaurantGuid={restaurantGuid} />
      </Suspense>
    </div>
  );
}
