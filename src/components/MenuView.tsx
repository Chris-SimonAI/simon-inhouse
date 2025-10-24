'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { MenuData, MenuItem } from '@/actions/menu';
import { MenuItemCard } from './MenuItemCard';
import { MenuItemDetails } from './MenuItemDetails';
import { CartButton } from './CartButton';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

type MenuViewProps = {
  menuData: MenuData;
  restaurantGuid: string;
};

export type CartItem = {
  id: string;
  menuItem: MenuItem;
  selectedModifiers: { [groupId: string]: string[] };
  quantity: number;
  totalPrice: number;
};

export function MenuView({ menuData, restaurantGuid }: MenuViewProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>(menuData.groups[0]?.id || '');
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const scrollYRef = useRef(0);

  useLayoutEffect(() => {
    if (!selectedItem) {
      window.scrollTo({ top: scrollYRef.current, behavior: "instant" });
    }
  }, [selectedItem]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [restaurantGuid]);

  // ScrollSpy effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // Offset for sticky header

      // Find the current section in view
      for (const group of menuData.groups) {
        const element = sectionRefs.current[group.id];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveTab(group.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Call once to set initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuData.groups]);

  const addToCart = (cartItem: CartItem) => {
    // Check if item with same menu item and modifiers already exists
    const existingItemIndex = cart.findIndex(item => {
      // Check if menu item ID matches
      if (item.menuItem.id !== cartItem.menuItem.id) return false;
      
      // Check if modifiers match
      const itemModifierKeys = Object.keys(item.selectedModifiers).sort();
      const newItemModifierKeys = Object.keys(cartItem.selectedModifiers).sort();
      
      if (itemModifierKeys.length !== newItemModifierKeys.length) return false;
      
      return itemModifierKeys.every(key => {
        const itemOptions = item.selectedModifiers[key]?.sort() || [];
        const newItemOptions = cartItem.selectedModifiers[key]?.sort() || [];
        
        if (itemOptions.length !== newItemOptions.length) return false;
        return itemOptions.every((opt, idx) => opt === newItemOptions[idx]);
      });
    });

    let newCart: CartItem[];
    
    if (existingItemIndex !== -1) {
      // Item exists, update quantity and price
      newCart = cart.map((item, index) => {
        if (index === existingItemIndex) {
          return {
            ...item,
            quantity: item.quantity + cartItem.quantity,
            totalPrice: item.totalPrice + cartItem.totalPrice
          };
        }
        return item;
      });
    } else {
      // Item doesn't exist, add as new
      newCart = [...cart, { ...cartItem, id: `${cartItem.menuItem.id}-${Date.now()}` }];
    }
    
    setCart(newCart);
    localStorage.setItem(`cart-${restaurantGuid}`, JSON.stringify(newCart));
    setSelectedItem(null);
  };

  const getTotalCartPrice = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getTotalCartItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const scrollToSection = (groupId: string) => {
    const element = sectionRefs.current[groupId];
    if (element) {
      const yOffset = -120; // Account for sticky header height
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const openItem = (item: MenuItem) => {
    scrollYRef.current = window.scrollY;
    setSelectedItem(item);
  };


  const handleClose = () => {
    if (selectedItem) {
      setSelectedItem(null);
    } else {
      router.push(`/dine-in/restaurant/${restaurantGuid}/details`);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {menuData.restaurantName}
          </h1>
          <Button
            onClick={() => handleClose()}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className={cn(
        selectedItem ? 'hidden' : 'flex flex-col flex-1'
      )}>
        {/* Sticky Navigation Tabs */}
        <div className="sticky top-0 z-40 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex overflow-x-auto scrollbar-hide">
              {menuData.groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => scrollToSection(group.id)}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-3 transition-colors ${activeTab === group.id
                    ? 'border-warm'
                    : 'border-transparent'
                    }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Content */}
        <div className="container mx-auto px-4 py-6 pb-0 flex-1">
          {menuData.groups.map((group) => (
            <section
              key={group.id}
              ref={(el) => {
                sectionRefs.current[group.id] = el;
              }}
              className="mb-3"
            >
              {/* Section Header */}
              <div className="mb-3">
                <h2 className="text-lg font-semibold mb-2">{group.name}</h2>
              </div>

              {/* Menu Items Grid */}
              <div className="grid grid-cols-1 gap-3">
                {group.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onSelect={() => openItem(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Cart Button */}
        {cart.length > 0 && (
          <div className="sticky bottom-0 z-50 p-4 mt-auto bg-white">
            <CartButton
              itemCount={getTotalCartItems()}
              totalPrice={getTotalCartPrice()}
              restaurantGuid={restaurantGuid}
            />
          </div>
        )}
      </div>

      {/* Item Details */}

      <div className={cn(
        selectedItem ? 'block' : 'hidden'
      )}>
        {selectedItem && (
          <MenuItemDetails
            item={selectedItem}
            onAddToCart={addToCart}
          />
        )}
      </div>
    </div>
  );
}
