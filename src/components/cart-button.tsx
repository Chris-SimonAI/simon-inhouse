'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useHotelSlug } from '@/hooks/use-hotel-slug';
import { hotelPath } from '@/utils/hotel-path';

type CartButtonProps = {
  itemCount: number;
  totalPrice: number;
  restaurantGuid: string;
};

export function CartButton({ itemCount, totalPrice, restaurantGuid }: CartButtonProps) {
  const slug = useHotelSlug();
  const href = slug
    ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/checkout`)
    : '#';

  return (
      <div className="container mx-auto">
        <Link href={href}>
          <Button 
            size="lg" 
            className="w-full bg-black hover:bg-black text-white rounded-full py-8"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <span>
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-bold">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </Button>
        </Link>
      </div>
  );
}

