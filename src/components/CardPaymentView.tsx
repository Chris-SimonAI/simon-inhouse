"use client";

import { useState, useEffect } from "react";
import StripePaymentForm from "./StripePaymentForm";

type CardPaymentViewProps = {
  restaurantGuid: string;
};

export function CardPaymentView({ restaurantGuid }: CardPaymentViewProps) {
  const [paymentDetails, setPaymentDetails] = useState({
    subtotal: 0,
    tax: 0,
    tip: 0,
    total: 0,
  });

  useEffect(() => {
    // Load payment details from localStorage
    const savedPaymentDetails = localStorage.getItem(
      `payment-details-${restaurantGuid}`
    );
    
    if (savedPaymentDetails) {
      try {
        const parsedDetails = JSON.parse(savedPaymentDetails);
        
        // Check if this is a valid payment session
        if (parsedDetails.sessionId && parsedDetails.status === 'pending') {
          // Check if session is not too old (5 minutes)
          const sessionAge = Date.now() - parsedDetails.timestamp;
          if (sessionAge > 5 * 60 * 1000) {
            console.log('Payment session expired, redirecting to checkout');
            localStorage.removeItem(`payment-details-${restaurantGuid}`);
            localStorage.removeItem(`payment-session-${restaurantGuid}`);
            window.location.href = `/dine-in/restaurant/${restaurantGuid}/checkout`;
            return;
          }
          
          setPaymentDetails(parsedDetails);
        } else if (parsedDetails.status === 'completed') {
          // Payment already completed, redirect to success
          console.log('Payment already completed, redirecting to success');
          window.location.href = `/?orderSuccess=true&orderId=${parsedDetails.orderId}&status=completed`;
          return;
        } else if (parsedDetails.status === 'processing') {
          // Payment is being processed, show processing state
          console.log('Payment is being processed');
          setPaymentDetails(parsedDetails);
        } else {
          // Invalid session, redirect to checkout
          console.log('Invalid payment session, redirecting to checkout');
          localStorage.removeItem(`payment-details-${restaurantGuid}`);
          localStorage.removeItem(`payment-session-${restaurantGuid}`);
          window.location.href = `/dine-in/restaurant/${restaurantGuid}/checkout`;
          return;
        }
      } catch (error) {
        console.error('Error parsing payment details:', error);
        setPaymentDetails({
          subtotal: 0,
          tax: 0,
          tip: 0,
          total: 0,
        });
      }
    }
  }, [restaurantGuid]);

  if (paymentDetails.total === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-4">No payment details found</p>
            <p className="text-gray-400 text-sm">Please go back and try again</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StripePaymentForm
      restaurantGuid={restaurantGuid}
      total={paymentDetails.total}
    />
  );
}
