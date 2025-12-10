"use client";

import { useState, useEffect, useRef } from "react";
import type { CartItem } from "./menu-view";
import { Button } from "@/components/ui/button";
import { ChevronRight, X, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";
import { ConfirmExitButton } from "@/components/confirm-exit-button";

type PaymentViewProps = {
  restaurantGuid: string;
  initialDiscountPercentage: number;
  deliveryFee: number;
  serviceFeePercent: number;
};

type PaymentMethod = "card" | "delivery";
type TipSelection = 18 | 20 | 25 | 0 | "custom";

export function PaymentView({ 
  restaurantGuid, 
  initialDiscountPercentage,
  deliveryFee,
  serviceFeePercent,
}: PaymentViewProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [selectedTip, setSelectedTip] = useState<TipSelection>(0);
  const [customTipAmount, setCustomTipAmount] = useState<string>("");
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const discountPercentage = initialDiscountPercentage;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      } catch (error) {
        console.error('Error parsing cart:', error);
        localStorage.removeItem(`cart-${restaurantGuid}`);
        setCart([]);
      }
    }

    // Restore saved tip selection
    const savedTipSelection = localStorage.getItem(`tip-selection-${restaurantGuid}`);
    if (savedTipSelection) {
      try {
        const tipData = JSON.parse(savedTipSelection);
        if (tipData.selectedTip !== undefined) {
          setSelectedTip(tipData.selectedTip);
        }
      } catch (error) {
        console.error('Error loading tip selection:', error);
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

  const getSubtotalAfterDiscount = () => {
    return getSubtotal() - getDiscountAmount();
  };

  const getServiceFee = () => {
    // Service fee is calculated on original subtotal (before discount)
    return (getSubtotal() * serviceFeePercent) / 100;
  };

  const getDeliveryFee = () => {
    return deliveryFee;
  };

  const getTipAmount = () => {
    if (selectedTip === "custom") {
      return parseFloat(customTipAmount) || 0;
    }
    if (selectedTip === 0) {
      return 0;
    }
    // Tip is calculated on the original subtotal (before discount, before fees)
    return getSubtotal() * (selectedTip / 100);
  };

  const getTotal = () => {
    // Total = subtotal - discount + service fee + delivery fee + tip
    // Note: This is for display only. Actual total is calculated server-side.
    return getSubtotalAfterDiscount() + getServiceFee() + getDeliveryFee() + getTipAmount();
  };

  const handleTipSelection = (tip: TipSelection) => {
    setSelectedTip(tip);
    if (tip === "custom") {
      setShowCustomTipInput(true);
    } else {
      setShowCustomTipInput(false);
      setCustomTipAmount("");
    }

    // Save tip selection to localStorage for persistence (excluding custom tip amount)
    localStorage.setItem(`tip-selection-${restaurantGuid}`, JSON.stringify({
      selectedTip: tip,
    }));
  };

  const buildRestaurantPath = (suffix: string) => {
    if (!slug) return null;
    return hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}${suffix}`);
  };

  const handleBack = () => {
    const path = buildRestaurantPath("/checkout");
    if (!path) return;
    router.push(path);
  };

  const clearCartAndPaymentState = () => {
    try {
      localStorage.removeItem(`cart-${restaurantGuid}`);
      localStorage.removeItem(`tip-selection-${restaurantGuid}`);
      localStorage.removeItem(`payment-details-${restaurantGuid}`);
      localStorage.removeItem(`payment-session-${restaurantGuid}`);
    } catch {
      // no-op
    }
  };

  const handleConfirmExit = () => {
    clearCartAndPaymentState();
    const path = buildRestaurantPath("/menu");
    if (!path) return;
    router.push(path);
  };

  const handlePayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Generate a unique session ID for this payment attempt
      const sessionId = `payment-${restaurantGuid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Build tipOption for secure payment flow
      const tipOption = selectedTip === "custom" 
        ? { type: 'fixed' as const, value: parseFloat(customTipAmount) || 0 }
        : { type: 'percentage' as const, value: selectedTip };
      
      // Store payment details in localStorage with session tracking
      // Note: These display values are for reference only. Actual prices are calculated server-side.
      const paymentData = {
        sessionId,
        subtotal: getSubtotal(),
        serviceFee: getServiceFee(),
        deliveryFee: getDeliveryFee(),
        discount: getDiscountAmount(),
        discountPercentage: discountPercentage,
        subtotalAfterDiscount: getSubtotalAfterDiscount(),
        tip: getTipAmount(),
        tipOption, // Include tipOption for secure payment flow
        total: getTotal(),
        cart: cart,
        timestamp: Date.now(),
        status: 'pending', // pending, processing, completed, failed
        attempts: 0,
      };
      
      localStorage.setItem(`payment-details-${restaurantGuid}`, JSON.stringify(paymentData));
      
      // Also store the session ID separately for tracking
      localStorage.setItem(`payment-session-${restaurantGuid}`, sessionId);
      
      if (paymentMethod === "card") {
        const path = buildRestaurantPath("/card-payment");
        if (!path) return;
        router.push(path);
      } else {
        // TODO: Handle delivery payment
        console.log("Processing delivery payment...", {
          paymentMethod,
          subtotal: getSubtotal(),
          tip: getTipAmount(),
          total: getTotal(),
        });
      }
    } catch (error) {
      console.error("Error preparing payment:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };


  const getItemDescription = (item: CartItem) => {
    const modifiers: string[] = [];

    Object.entries(item.selectedModifiers).forEach(([groupId, optionIds]) => {
      const group = item.menuItem.modifierGroups.find((g) => g.id === groupId);
      if (group && optionIds.length > 0) {
        const selectedOptions = optionIds
          .map((optionId) => {
            const option = group.options.find((o) => o.id === optionId);
            return option ? option.name : "";
          })
          .filter(Boolean);

        if (selectedOptions.length > 0) {
          modifiers.push(selectedOptions.join(", "));
        }
      }
    });

    return modifiers.length > 0 ? ` - ${modifiers.join(", ")}` : "";
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">Menu</h1>
            <button
              type="button"
              onClick={handleBack}
              className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-4">No items in your cart</p>
            <Button
              onClick={() => {
                const path = buildRestaurantPath("/menu");
                if (!path) return;
                router.push(path);
              }}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Go to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-dvh bg-gray-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-900"
            aria-label="Back to Order Summary"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-base font-medium">Menu</span>
          </button>

          <ConfirmExitButton
            container={containerRef.current}
            title="Leave payment?"
            description="Leaving now will clear your cart and return you to the restaurant menu. Continue?"
            onConfirm={handleConfirmExit}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 bg-[#f2f2f2] p-4">
        {/* Payment Options */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Payment Options
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="space-y-3">
            <div className="text-[14px] text-gray-900 mb-3">
              How would you like to pay?
            </div>

            <div className="flex flex-col gap-5 pl-2">
              {/* Pay now with card */}
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg transition-colors"
                )}
              >
                <span className="text-base font-medium text-gray-900">
                  Pay now with card
                </span>
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    paymentMethod === "card"
                      ? "border-gray-900"
                      : "border-gray-300"
                  )}
                >
                  {paymentMethod === "card" && (
                    <div className="w-3 h-3 rounded-full bg-gray-900" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Order Summary
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start text-base"
              >
                <div className="flex-1">
                  <span className="text-gray-900">
                    {item.quantity} x {item.menuItem.name}
                  </span>
                  <span className="text-gray-600">
                    {getItemDescription(item)}
                  </span>
                </div>
                <span className="text-gray-900 font-medium ml-4">
                  {item.totalPrice.toFixed(2)} USD
                </span>
              </div>
            ))}

            <div className="border-t border-gray-200 border-dashed pt-3 mt-3 space-y-2">
              <div className="flex justify-between items-center text-base">
                <span className="font-semibold text-gray-900">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {getSubtotal().toFixed(2)} USD
                </span>
              </div>
              
              {discountPercentage > 0 && (
                <div className="flex justify-between items-center text-base text-green-600">
                  <span className="font-medium">Discount ({discountPercentage}%)</span>
                  <span className="font-medium">
                    -{getDiscountAmount().toFixed(2)} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tip Section */}

          <h2 className="text-lg font-bold text-gray-900 mb-4 mt-5">
            Would you like to add a tip?
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[18, 20, 25].map((tip) => (
              <button
                key={tip}
                type="button"
                onClick={() => handleTipSelection(tip as TipSelection)}
                className={cn(
                  "py-2 px-2 rounded-lg border-2 text-base font-medium transition-colors",
                  selectedTip === tip
                    ? "border-gray-900 bg-gray-50 text-gray-900"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                )}
              >
                {tip}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleTipSelection(0)}
              className={cn(
                "py-2 px-2 rounded-lg border-2 text-base font-medium transition-colors",
                selectedTip === 0
                  ? "border-gray-900 bg-gray-50 text-gray-900"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              )}
            >
              No tip
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleTipSelection("custom")}
            className={cn(
              "w-full py-2 px-2 rounded-lg border-2 text-base font-medium transition-colors",
              selectedTip === "custom"
                ? "border-gray-900 bg-gray-50 text-gray-900"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
            )}
          >
            Custom tip
          </button>

          {showCustomTipInput && (
            <div className="mt-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={customTipAmount}
                onChange={(e) => setCustomTipAmount(e.target.value)}
                placeholder="Enter custom tip amount"
                className="w-full py-2 px-4 rounded-lg border-2 border-gray-300 text-base focus:border-gray-900 focus:outline-none"
              />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {/* Service Fee */}
            {serviceFeePercent > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-600">Service Fee ({serviceFeePercent}%)</span>
                <span className="text-gray-900">
                  {getServiceFee().toFixed(2)} USD
                </span>
              </div>
            )}
            
            {/* Delivery Fee */}
            {deliveryFee > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900">
                  {getDeliveryFee().toFixed(2)} USD
                </span>
              </div>
            )}
            
            {getTipAmount() > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-900">Tip</span>
                <span className="text-gray-900">
                  {getTipAmount().toFixed(2)} USD
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Estimated Total</span>
              <span className="text-gray-900">{getTotal().toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Payment Method Footer Text */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          {paymentMethod === "card" ? "Pay now with card" : "Pay on delivery"}
        </h2>
        <div className="bg-white px-4 py-6">
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-[2px] py-7 text-base font-semibold flex items-center justify-center disabled:opacity-50"
            size="lg"
          >
            <span>{isProcessing ? "Processing..." : "Pay now with card"}</span>
            {!isProcessing && <ChevronRight />}
          </Button>
        </div>
        <div className="mt-3 text-xs text-gray-500 text-center">
          Meet Simon&apos;s privacy policy & SMS policy regarding Internet
          information |{" "}
          <Link href="/privacy" className="text-blue-600 underline">
            Your Privacy Choices
          </Link>
        </div>
      </div>
    </div>
  );
}
