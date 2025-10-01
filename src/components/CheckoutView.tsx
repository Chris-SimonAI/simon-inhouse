'use client';

import { useState, useEffect } from 'react';
import { CartItem } from './MenuView';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type CheckoutViewProps = {
  restaurantGuid: string;
};

export function CheckoutView({ restaurantGuid }: CheckoutViewProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [restaurantGuid]);

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getModifierText = (item: CartItem) => {
    const modifiers: string[] = [];

    Object.entries(item.selectedModifiers).forEach(([groupId, optionIds]) => {
      const group = item.menuItem.modifierGroups.find(g => g.id === groupId);
      if (group && optionIds.length > 0) {
        const selectedOptions = optionIds.map(optionId => {
          const option = group.options.find(o => o.id === optionId);
          return option ? option.name : '';
        }).filter(Boolean);

        if (selectedOptions.length > 0) {
          modifiers.push(`${group.name}: ${selectedOptions.join(', ')}`);
        }
      }
    });

    return modifiers;
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Link
            href={`/dine-in/restaurant/${restaurantGuid}/menu`}
            className="mr-4"
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Order Summary</h1>
        </div>

        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Your order summary is empty</p>
          <Link href={`/dine-in/restaurant/${restaurantGuid}/menu`}>
            <Button>Start Ordering</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
            Order Summary
          </h1>
          <Link
            href={`/dine-in/restaurant/${restaurantGuid}/menu`}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 px-4 flex-1">
        {/* Cart items */}
        <div className="space-y-1">
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-4 border-b border-gray-200">
              <div>
                <h3 className="font-medium text-lg">{item.menuItem.name}</h3>
                {/* Modifiers */}
                {getModifierText(item).length > 0 && (
                  <div className="space-y-1 mt-1">
                    {getModifierText(item).map((modifier, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        {modifier}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right font-semibold">
                <div className="flex items-center text-base">
                  <span>{item.quantity}</span>
                  <span className="mx-2">@</span>
                  <span>${(item.totalPrice / item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center py-4">
            <div>
              <h3 className="font-medium text-lg">Total</h3>
            </div>
            <div className="text-right font-semibold">
              <span>${getTotalPrice().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom checkout button */}
      <div className="sticky bottom-0 z-50 p-4">
        <Button
          onClick={() => router.push(`/dine-in/restaurant/${restaurantGuid}/payment`)}
          className="w-full bg-black text-white hover:bg-gray-800 rounded-full py-8 text-lg font-semibold flex items-center justify-between px-6"
          size="lg"
        >
          <span>Checkout</span>
          <span>${getTotalPrice().toFixed(2)}</span>
        </Button>
      </div>
    </div>
  );
}

