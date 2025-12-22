"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "./menu-view";
import { Button } from "@/components/ui/button";
import { ChevronRight, X, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";
import { ConfirmExitButton } from "@/components/confirm-exit-button";
import { clearCheckoutState } from "@/utils/clear-checkout-state";
import { loadStripe } from "@stripe/stripe-js";
import { stripePublishableKey } from "@/lib/stripe-client";
import {
  buildTipOption,
  calculateTotals,
  type PaymentMethod,
  type TipSelection,
} from "@/lib/payments/totals";
import {
  loadCartFromStorage,
  loadPaymentMethod,
  loadTipSelection,
  savePaymentDetails,
  savePaymentMethod,
  savePaymentSessionId,
  saveTipSelection,
} from "@/lib/payments/storage";
import { useApplePayAvailability } from "@/hooks/use-apple-pay-availability";

type PaymentViewProps = {
  restaurantGuid: string;
  initialDiscountPercentage: number;
  deliveryFee: number;
  serviceFeePercent: number;
  showTips: boolean;
};

export function PaymentView({ 
  restaurantGuid, 
  initialDiscountPercentage,
  deliveryFee,
  serviceFeePercent,
  showTips,
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

  const totals = calculateTotals({
    cart,
    discountPercentage,
    serviceFeePercent,
    deliveryFee,
    tipSelection: selectedTip,
    customTipAmount: parseFloat(customTipAmount) || 0,
  });

  useEffect(() => {
    if (!showTips) {
      setSelectedTip(0);
      setShowCustomTipInput(false);
      setCustomTipAmount("");
    }
  }, [showTips]);

  useEffect(() => {
    setCart(loadCartFromStorage(restaurantGuid) as CartItem[]);

    const storedTip = loadTipSelection(restaurantGuid);
    if (storedTip !== null) {
      setSelectedTip(storedTip);
    }

    const storedPaymentMethod = loadPaymentMethod(restaurantGuid);
    if (storedPaymentMethod) {
      setPaymentMethod(storedPaymentMethod);
    }
  }, [restaurantGuid]);

  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [],
  );

  const { paymentRequest, canUseApplePay, isChecking: isCheckingApplePay } = useApplePayAvailability({
    stripeOrPromise: stripePromise,
    amountCents: totals.amountCents,
    label: "Total",
    requireApplePay: true,
  });

  useEffect(() => {
    if (!canUseApplePay && paymentMethod === "applePay") {
      setPaymentMethod("card");
    }
  }, [canUseApplePay, paymentMethod]);

  const handleTipSelection = (tip: TipSelection) => {
    setSelectedTip(tip);
    if (tip === "custom") {
      setShowCustomTipInput(true);
    } else {
      setShowCustomTipInput(false);
      setCustomTipAmount("");
    }

    if (showTips) {
      saveTipSelection(restaurantGuid, tip);
    }
  };

  const buildRestaurantPath = (suffix: string) => {
    if (!slug) return null;
    return hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}${suffix}`);
  };

  const handleConfirmExit = () => {
    clearCheckoutState(restaurantGuid);
    const path = buildRestaurantPath("/menu");
    if (!path) return;
    router.push(path);
  };

  const handlePayment = async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const sessionId = `payment-${restaurantGuid}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const tipOption = buildTipOption(
        selectedTip,
        parseFloat(customTipAmount) || 0,
      );

      const paymentData = {
        sessionId,
        subtotal: totals.subtotal,
        serviceFee: totals.serviceFee,
        deliveryFee,
        discount: totals.discountAmount,
        discountPercentage,
        subtotalAfterDiscount: totals.subtotalAfterDiscount,
        tip: totals.tipAmount,
        tipOption,
        total: totals.total,
        cart,
        timestamp: Date.now(),
        status: "pending" as const,
        attempts: 0,
        paymentMethod,
        canUseApplePay,
      };

      savePaymentDetails(restaurantGuid, paymentData);
      savePaymentMethod(restaurantGuid, paymentMethod);
      savePaymentSessionId(restaurantGuid, sessionId);

      const path = buildRestaurantPath("/card-payment");
      if (!path) return;
      router.push(path);
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
            <Link
              href={buildRestaurantPath("/checkout") ?? '#'}
              className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-4">No items in your cart</p>
            <Link href={buildRestaurantPath("/menu") ?? '#'}>
              <Button className="bg-gray-900 text-white hover:bg-gray-800">
                Go to Menu
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href={buildRestaurantPath("/checkout") ?? '#'}
            className="flex items-center gap-2 text-gray-900"
            aria-label="Back to Order Summary"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-base font-medium">Menu</span>
          </Link>

          <ConfirmExitButton
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
            {isCheckingApplePay && (
              <p className="text-xs text-gray-500">Checking Apple Pay availability...</p>
            )}

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

              {paymentRequest && (canUseApplePay || isCheckingApplePay) && (
                <button
                  type="button"
                  onClick={() => !isCheckingApplePay && setPaymentMethod("applePay")}
                  disabled={isCheckingApplePay}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg transition-colors",
                    isCheckingApplePay && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <span className="text-base font-medium text-gray-900">
                    {isCheckingApplePay ? "Checking Apple Pay..." : "Apple Pay / Wallet"}
                  </span>
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                      paymentMethod === "applePay"
                        ? "border-gray-900"
                        : "border-gray-300"
                    )}
                  >
                    {paymentMethod === "applePay" && (
                      <div className="w-3 h-3 rounded-full bg-gray-900" />
                    )}
                  </div>
                </button>
              )}
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
                  {totals.subtotal.toFixed(2)} USD
                </span>
              </div>
              
              {discountPercentage > 0 && (
                <div className="flex justify-between items-center text-base text-green-600">
                  <span className="font-medium">Discount ({discountPercentage}%)</span>
                  <span className="font-medium">
                    -{totals.discountAmount.toFixed(2)} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tip Section */}

          {showTips ? (
            <>
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
            </>
          ) : null}

          <div className="mt-4 space-y-2">
            {/* Service Fee */}
            {serviceFeePercent > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-600">Taxes and Services</span>
                <span className="text-gray-900">
                  {totals.serviceFee.toFixed(2)} USD
                </span>
              </div>
            )}
            
            {/* Delivery Fee */}
            {deliveryFee > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900">
                  {totals.deliveryFee.toFixed(2)} USD
                </span>
              </div>
            )}
            
            {totals.tipAmount > 0 && (
              <div className="flex justify-between items-center text-base">
                <span className="text-gray-900">Tip</span>
                <span className="text-gray-900">
                  {totals.tipAmount.toFixed(2)} USD
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Estimated Total</span>
              <span className="text-gray-900">{totals.total.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Service Fee Disclaimer */}
        {/* {serviceFeePercent > 0 && (
          <p className="text-gray-600 mt-3">
            Simon charges a {serviceFeePercent}% service fee to address delivery
            fees and tips.
          </p>
        )} */}

        {/* Payment Method Footer Text */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          {paymentMethod === "applePay" ? "Pay now with Apple Pay" : "Pay now with card"}
        </h2>
        <div className="bg-white px-4 py-6">
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-[2px] py-7 text-base font-semibold flex items-center justify-center disabled:opacity-50"
            size="lg"
          >
            <span>
              {isProcessing
                ? "Processing..."
                : paymentMethod === "applePay"
                ? "Pay now with Apple Pay"
                : "Pay now with card"}
            </span>
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
