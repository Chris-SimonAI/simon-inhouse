"use client";

import { PaymentProcessingScreen } from "@/components/PaymentProcessingScreen";
import { useParams } from "next/navigation";

export default function PaymentProcessingPage() {
  const params = useParams();
  const tipId = parseInt(params.tipId as string);

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <PaymentProcessingScreen tipId={tipId} />
    </div>
  );
}
