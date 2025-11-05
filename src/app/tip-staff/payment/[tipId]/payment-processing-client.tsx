"use client";

import { PaymentProcessingScreen } from "@/components/payment-processing-screen";

interface PaymentProcessingClientProps {
  tipId: number;
}

export default function PaymentProcessingClient({
  tipId,
}: PaymentProcessingClientProps) {
  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <PaymentProcessingScreen tipId={tipId} />
    </div>
  );
}
