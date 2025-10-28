import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MenuView } from '@/components/menu-view';
import { getCompleteMenuByRestaurant } from '@/actions/menu';

type PageProps = {
  params: Promise<{
    restaurantGuid: string;
  }>;
};

export default async function MenuPage({ params }: PageProps) {
  const { restaurantGuid } = await params;

  const result = await getCompleteMenuByRestaurant({ guid: restaurantGuid });

  if (!result.ok) {
    notFound();
  }

  return (
    <Suspense fallback={<div>Loading menu...</div>}>
      <MenuView 
        menuData={result.data} 
        restaurantGuid={restaurantGuid}
      />
    </Suspense>
  );
}