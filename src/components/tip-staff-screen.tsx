"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Delete, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createTip } from "@/actions/tips";
import { DEFAULT_HOTEL_ID } from "@/constants";
import Image from "next/image";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";

interface TipStaffScreenProps {
  initialAmount?: number;
  dynamicMessage?: string;
  hotelName?: string;
  hotelId?: number;
}

const tipAmounts = [5, 10, 15, 20, 25];

export function TipStaffScreen({ initialAmount, dynamicMessage, hotelName, hotelId }: TipStaffScreenProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const [selectedAmount, setSelectedAmount] = useState<number>(initialAmount || 0);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
    setShowCustomInput(false);
  };

  const handleOtherClick = () => {
    setShowCustomInput(true);
    setCustomAmount("");
    setSelectedAmount(0);
  };

  const _handleNumberPadInput = (value: string) => {
    if (value === "backspace") {
      setCustomAmount((prev: string) => prev.slice(0, -1));
    } else if (value === "00") {
      setCustomAmount((prev: string) => prev + "00");
    } else {
      setCustomAmount((prev: string) => prev + value);
    }
  };

  const _handleCustomAmountConfirm = () => {
    const numValue = parseFloat(customAmount);
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedAmount(numValue);
      setShowCustomInput(false);
    }
  };

  const handleNumberPadInputWithConfirm = (value: string) => {
    if (value === "backspace") {
      setCustomAmount((prev: string) => prev.slice(0, -1));
    } else if (value === "00") {
      // Prevent adding 00 if it would make the amount too large or invalid
      const newAmount = customAmount + "00";
      if (newAmount.length <= 6) { // Limit to reasonable amount (max $9999.99)
        setCustomAmount(newAmount);
      }
    } else {
      // Prevent adding more digits if it would exceed reasonable limit
      const newAmount = customAmount + value;
      if (newAmount.length <= 6) { // Limit to reasonable amount (max $9999.99)
        setCustomAmount(newAmount);
      }
    }
  };

  const handleBackToAmounts = () => {
    setShowCustomInput(false);
    setCustomAmount("");
    setSelectedAmount(0);
  };

  const handlePayment = async () => {
    if (isProcessing || selectedAmount <= 0) return;
    
    setIsProcessing(true);
    
    try {
      const tipData = {
        hotelId: hotelId || DEFAULT_HOTEL_ID,
        amount: selectedAmount.toString(),
        currency: "USD",
        paymentMethod: "credit_card" as const,
        message: "Thank you for your service!"
      };

      const result = await createTip(tipData);
      
      if (result.ok && result.data) {
        // Navigate to payment processing screen
        router.push(`${hotelPath(slug, `/tip-staff/payment/${result.data.id}`)}`);
      } else {
        console.error("Failed to create tip:", !result.ok ? result.message : "Unknown error");
      }
    } catch (error) {
      console.error("Error processing tip:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const _getAmountDisplay = () => {
    return selectedAmount > 0 ? selectedAmount.toFixed(2) : "0.00";
  };

  const getCustomAmountDisplay = () => {
    if (!customAmount) return "0.00";
    // Format as currency with decimal point
    const numValue = parseFloat(customAmount) / 100; // Treat input as cents
    return !isNaN(numValue) ? numValue.toFixed(2) : "0.00";
  };

  const handleTipCustomAmount = async () => {
    const numValue = parseFloat(customAmount) / 100; // Convert cents to dollars
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedAmount(numValue);
      setShowCustomInput(false);
      // Don't automatically process payment, let user choose payment method
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
        <button
          onClick={() => router.push(`/${slug}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Simon</span>
        </button>
        <div className="text-sm font-medium text-gray-900">Tip Service</div>
        <div className="w-12"></div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-6">
        {!showCustomInput && (
          <>
            {/* Text Message */}
            <div className="text-center mb-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                {dynamicMessage || `We appreciate your generosity in tipping the team. Our service team is critical to making your stay ${hotelName ? `at ${hotelName}` : 'here'} the best it can be.`}
              </p>
            </div>

            {/* Staff Image */}
            <div className="text-center mb-8">
              <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
                {/* Aspect ratio container using padding-bottom technique */}
                <div className="relative w-full pb-[50%] sm:pb-[55%] md:pb-[60%] lg:pb-[65%] xl:pb-[70%] rounded-lg bg-gray-50 overflow-hidden shadow-sm border border-gray-200">
                  <Image 
                    src="/staff-team.jpg" 
                    alt="Our Amazing Hotel Service Team" 
                    fill
                    className="object-cover transition-all duration-300 hover:scale-105"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {showCustomInput && (
          <>
            {/* Close Button */}
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleBackToAmounts}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Custom Amount Header */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Custom Tip Amount</h2>
              <p className="text-sm text-gray-600">Enter a custom tip amount here</p>
            </div>

            {/* Amount Display */}
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-900 mb-2 border-b-2 border-gray-300 pb-2 inline-block">
                ${getCustomAmountDisplay()}
              </div>
            </div>
          </>
        )}

        {/* Amount Selection or Custom Input */}
        {!showCustomInput ? (
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {tipAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleAmountSelect(amount)}
                  className={cn(
                    "h-12 rounded-lg border-2 font-medium transition-colors",
                    selectedAmount === amount
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  ${amount}
                </button>
              ))}
              <button
                onClick={handleOtherClick}
                className={cn(
                  "h-12 rounded-lg border-2 font-medium transition-colors",
                  selectedAmount > 0 && !tipAmounts.includes(selectedAmount)
                    ? "border-orange-500 bg-orange-50 text-orange-600"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                )}
              >
                {selectedAmount > 0 && !tipAmounts.includes(selectedAmount) ? `$${selectedAmount.toFixed(2)}` : "Other"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberPadInputWithConfirm(num.toString())}
                  className="h-14 rounded-lg bg-white border border-gray-300 text-xl font-bold text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleNumberPadInputWithConfirm("0")}
                className="h-14 rounded-lg bg-white border border-gray-300 text-xl font-bold text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
              >
                0
              </button>
              <button
                onClick={() => handleNumberPadInputWithConfirm("00")}
                className="h-14 rounded-lg bg-white border border-gray-300 text-xl font-bold text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
              >
                00
              </button>
              <button
                onClick={() => handleNumberPadInputWithConfirm("backspace")}
                className="h-14 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Delete className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            

          </div>
        )}

        {!showCustomInput && (
          <>
            {/* Payment Methods */}
            <div className="mb-8">
              <div className="space-y-3">
                 <button
                   onClick={() => {
                     if (selectedAmount > 0) {
                       handlePayment();
                     }
                   }}
                   className="w-full h-12 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-colors border-black bg-black text-white"
                 >
                   <CreditCard className="w-5 h-5" />
                   Tip using Credit Card
                 </button>
              </div>
            </div>
          </>
        )}

        {/* Process Button - Only show on custom input screen */}
         {showCustomInput && (
           <Button
             onClick={handleTipCustomAmount}
             disabled={!customAmount || customAmount === "0" || isProcessing}
             className="w-full h-12 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
           >
             {isProcessing ? "Processing..." : "Tip using Credit Card"}
           </Button>
         )}


      </div>


    </div>
  );
}
