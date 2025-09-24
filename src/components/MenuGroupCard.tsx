'use client';

import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { MenuGroup } from '@/actions/menu';

type MenuGroupCardProps = {
  group: MenuGroup;
  restaurantGuid: string;
};

export function MenuGroupCard({ group, restaurantGuid }: MenuGroupCardProps) {
  return (
    <Link href={`/dine-in/restaurant/${restaurantGuid}/menu?section=${group.id}`}>
      <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200">
        <CardContent className="p-0">
          {group.imageUrl && (
            <div className="relative h-48 w-full">
              <Image
                src={group.imageUrl}
                alt={group.name}
                fill
                className="object-cover rounded-t-lg"
              />
            </div>
          )}
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{group.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-600 font-medium">
                {group.items.length} item{group.items.length !== 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-500">View Menu →</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

