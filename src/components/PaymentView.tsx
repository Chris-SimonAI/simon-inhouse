"use client";

import { useState, useEffect } from "react";
import { CartItem } from "./MenuView";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type PaymentViewProps = {
  restaurantGuid: string;
};

type PaymentMethod = "card" | "delivery";
type TipOption = 18 | 20 | 25 | 0 | "custom";

export function PaymentView({ restaurantGuid }: PaymentViewProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [selectedTip, setSelectedTip] = useState<TipOption>(0);
  const [customTipAmount, setCustomTipAmount] = useState<string>("");
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
  }, [restaurantGuid]);

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getTaxRate = () => {
    // Assuming 9.75% tax rate (adjust as needed)
    return 0.0975;
  };

  const getTaxAmount = () => {
    return getSubtotal() * getTaxRate();
  };

  const getTipAmount = () => {
    if (selectedTip === "custom") {
      return parseFloat(customTipAmount) || 0;
    }
    if (selectedTip === 0) {
      return 0;
    }
    return getSubtotal() * (selectedTip / 100);
  };

  const getTotal = () => {
    return getSubtotal() + getTaxAmount() + getTipAmount();
  };

  const handleTipSelection = (tip: TipOption) => {
    setSelectedTip(tip);
    if (tip === "custom") {
      setShowCustomTipInput(true);
    } else {
      setShowCustomTipInput(false);
      setCustomTipAmount("");
    }
  };

  const handleClose = () => {
    router.push(`/dine-in/restaurant/${restaurantGuid}/checkout`);
  };

  const handlePayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Generate a unique session ID for this payment attempt
      const sessionId = `payment-${restaurantGuid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store payment details in localStorage with session tracking
      const paymentData = {
        sessionId,
        subtotal: getSubtotal(),
        tax: getTaxAmount(),
        tip: getTipAmount(),
        total: getTotal(),
        cart: cart,
        timestamp: Date.now(),
        status: 'pending', // pending, processing, completed, failed
        attempts: 0
      };
      
      localStorage.setItem(`payment-details-${restaurantGuid}`, JSON.stringify(paymentData));
      
      // Also store the session ID separately for tracking
      localStorage.setItem(`payment-session-${restaurantGuid}`, sessionId);
      
      if (paymentMethod === "card") {
        router.push(`/dine-in/restaurant/${restaurantGuid}/card-payment`);
      } else {
        // TODO: Handle delivery payment
        console.log("Processing delivery payment...", {
          paymentMethod,
          subtotal: getSubtotal(),
          tax: getTaxAmount(),
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
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">Menu</h1>
            <button
              onClick={handleClose}
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
              onClick={() =>
                router.push(`/dine-in/restaurant/${restaurantGuid}/menu`)
              }
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Menu</h1>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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

              {/* Pay on delivery */}
              <button
                disabled
                onClick={() => setPaymentMethod("delivery")}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg transition-colors"
                )}
              >
                <span className="text-base font-medium text-gray-500">
                  Pay on delivery
                </span>
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    paymentMethod === "delivery"
                      ? "border-gray-900"
                      : "border-gray-300"
                  )}
                >
                  {paymentMethod === "delivery" && (
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

            <div className="border-t border-gray-200 border-dashed pt-3 mt-3">
              <div className="flex justify-between items-center text-base">
                <span className="font-semibold text-gray-900">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {getSubtotal().toFixed(2)} USD
                </span>
              </div>
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
                onClick={() => handleTipSelection(tip as TipOption)}
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
            <div className="flex justify-between items-center text-base">
              <span className="text-gray-900">Tax</span>
              <span className="text-gray-900">
                {getTaxAmount().toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total</span>
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
          <a href="#" className="text-blue-600 underline">
            Your Privacy Choices
          </a>
        </div>
      </div>
    </div>
  );
}
