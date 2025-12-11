'use client';

import { MenuItem } from '@/actions/menu';
import { getMenuItemStartingPrice } from '@/lib/pricing';
import Image from 'next/image';

type MenuItemCardProps = {
  item: MenuItem;
  onSelect: () => void;
};

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const displayedPrice =
    item.price > 0 ? item.price : getMenuItemStartingPrice(item);
  return (
    <div
      className="cursor-pointer border border-gray-300 p-4 rounded-lg"
      onClick={onSelect}
    >
      <div className="flex gap-4">
        {/* Image */}
        {item.imageUrl && (
          <div className="relative h-24 w-24 flex-shrink-0">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate pr-2">
            {item.name}
          </h3>

          <p className="text-sm line-clamp-2 mb-2">
            {item.description}
          </p>

          <span className="text-base font-semibold text-gray-900 flex-shrink-0">
            ${displayedPrice.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

