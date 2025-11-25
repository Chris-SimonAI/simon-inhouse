'use client';

import { useState, useEffect } from 'react';
import type { CartItem } from './menu-view';
import { Button } from '@/components/ui/button';
import {X, Trash2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotelSlug } from '@/hooks/use-hotel-slug';
import { hotelPath } from '@/utils/hotel-path';

type CheckoutViewProps = {
  restaurantGuid: string;
  initialDiscountPercentage: number;
};

export function CheckoutView({ restaurantGuid, initialDiscountPercentage }: CheckoutViewProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const [cart, setCart] = useState<CartItem[]>([]);
  const discountPercentage = initialDiscountPercentage;

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
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

  const updateCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    localStorage.setItem(`cart-${restaurantGuid}`, JSON.stringify(updatedCart));
  };

  const removeItem = (itemId: string) => {
    const updatedCart = cart.filter(item => item.id !== itemId);
    updateCart(updatedCart);
  };

  const increaseQuantity = (itemId: string) => {
    const updatedCart = cart.map(item => {
      if (item.id === itemId) {
        const pricePerItem = item.totalPrice / item.quantity;
        return {
          ...item,
          quantity: item.quantity + 1,
          totalPrice: (item.quantity + 1) * pricePerItem
        };
      }
      return item;
    });
    updateCart(updatedCart);
  };

  const decreaseQuantity = (itemId: string) => {
    const updatedCart = cart.map(item => {
      if (item.id === itemId) {
        if (item.quantity === 1) {
          return null;
        }
        const pricePerItem = item.totalPrice / item.quantity;
        return {
          ...item,
          quantity: item.quantity - 1,
          totalPrice: (item.quantity - 1) * pricePerItem
        };
      }
      return item;
    }).filter((item): item is CartItem => item !== null);
    updateCart(updatedCart);
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
      <div className="flex flex-col min-h-dvh">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
              Order Summary
            </h1>
            <Link
              href={
                slug
                  ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/menu`)
                  : '#'
              }
              className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Empty state content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="mb-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-500 mb-6">
              Add items from the menu to get started
            </p>
            <Link
              href={
                slug
                  ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/menu`)
                  : '#'
              }
            >
              <Button className="w-full bg-black text-white hover:bg-gray-800 rounded-full py-6 text-base font-semibold">
                Browse Menu
              </Button>
            </Link>
          </div>
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
            href={
              slug
                ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/menu`)
                : '#'
            }
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
              {/* Item name and delete */}
              <div className="flex justify-between items-start gap-2 mb-2 items-center">
                <h3 className="font-medium text-base flex-1">{item.menuItem.name}</h3>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-400 p-1"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>

              {/* Modifiers */}
              {getModifierText(item).length > 0 && (
                <div className="space-y-0.5 mb-3">
                  {getModifierText(item).map((modifier) => (
                    <div key={modifier} className="text-xs text-gray-500">
                      {modifier}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Quantity controls and price */}
              <div className="flex items-center justify-between mt-3">
                <div className="inline-flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={() => decreaseQuantity(item.id)}
                    className="p-2 hover:bg-gray-50 rounded-l-lg transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3 text-sm font-medium min-w-[2rem] text-center border-x border-gray-200">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => increaseQuantity(item.id)}
                    className="p-2 hover:bg-gray-50 rounded-r-lg transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-base font-semibold">
                  ${item.totalPrice.toFixed(2)}
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
          onClick={() => {
            if (!slug) return;
            router.push(
              hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/payment`),
            );
          }}
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