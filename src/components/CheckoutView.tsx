'use client';

import { useState, useEffect } from 'react';
import type { CartItem } from './MenuView';
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
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Check for dining discount cookie
    const cookies = document.cookie.split(';');
    const discountCookie = cookies.find(cookie => 
      cookie.trim().startsWith('dining_discount=')
    );
    
    if (discountCookie) {
      const discountValue = parseInt(discountCookie.split('=')[1]);
      if (!Number.isNaN(discountValue) && discountValue > 0) {
        setDiscountPercentage(discountValue);
      }
    }
  }, [restaurantGuid]);

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getDiscountAmount = () => {
    if (discountPercentage === 0) return 0;
    return (getSubtotal() * discountPercentage) / 100;
  };

  const getTotalPrice = () => {
    return getSubtotal() - getDiscountAmount();
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
    <div className="flex flex-col min-h-dvh">
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
            <div key={item.id} className="py-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <h3 className="font-medium text-lg">{item.menuItem.name}</h3>
                  {/* Modifiers - Fixed expansion */}
                  {getModifierText(item).length > 0 && (
                    <div className="space-y-1 mt-2">
                      {getModifierText(item).map((modifier) => (
                        <div key={modifier} className="text-sm text-gray-600 leading-relaxed">
                          {modifier}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right font-semibold flex-shrink-0">
                  <div className="flex items-center text-base">
                    <span>{item.quantity}</span>
                    <span className="mx-2">@</span>
                    <span>${(item.totalPrice / item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Order Summary */}
          <div className="space-y-2 py-4">
            <div className="flex justify-between items-center">
              <span className="text-base">Subtotal</span>
              <span className="font-semibold">${getSubtotal().toFixed(2)}</span>
            </div>
            
            {discountPercentage > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span className="text-base">Discount ({discountPercentage}%)</span>
                <span className="font-semibold">-${getDiscountAmount().toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <h3 className="font-medium text-lg">Total</h3>
              <span className="text-right font-semibold text-lg">${getTotalPrice().toFixed(2)}</span>
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

