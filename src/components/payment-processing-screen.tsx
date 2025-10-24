"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTipById, updateTipStatus } from "@/actions/tips";
import { toast } from "sonner";
import { type Tip } from "@/db/schemas/tips";

interface PaymentProcessingScreenProps {
  tipId: number;
}

type PaymentStatus = "processing" | "success" | "failed";

export function PaymentProcessingScreen({ tipId }: PaymentProcessingScreenProps) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>("processing");
  const [_tipData, setTipData] = useState<Tip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get tip data
        const tipResult = await getTipById(tipId);
        if (!tipResult.ok) {
          setError("Tip not found");
          setStatus("failed");
          return;
        }

        if (tipResult.data) {
          setTipData(tipResult.data);
        }

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Always succeed for demo purposes
        const success = true; // Changed from Math.random() > 0.1 to always succeed

        if (success) {
          // Update tip status to completed
          await updateTipStatus({
            tipId,
            status: "completed",
            transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          });
          
          // Show success toast
          if (tipResult.data) {
            toast.success("Tip Sent", {
              description: `$${tipResult.data.amount} tip has been processed successfully`,
            });
          }
          router.push("/?tipping_return=true");
        } else {
          // Update tip status to failed
          await updateTipStatus({
            tipId,
            status: "failed",
          });
          setStatus("failed");
          setError("Payment failed. Please try again.");
        }
      } catch (err) {
        console.error("Payment processing error:", err);
        setStatus("failed");
        setError("Payment processing failed. Please try again.");
      }
    };

    processPayment();
  }, [tipId, router]);

  const handleBackToHome = () => {
    router.push("/?tipping_return=true");
  };

  const handleRetryPayment = () => {
    router.push("/tip-staff");
  };

  if (status === "processing") {
    return (
      <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Processing Payment</h1>
          <p className="text-gray-600 text-center mb-8">
            Please wait while we process your tip payment. This may take a few moments.
          </p>
          
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>Processing</span>
              <span>Please wait...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    // Instead of showing full page success, we show notification and redirect
    // The notification will be rendered by the parent component
    return null;
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white relative">
        {/* Processing UI */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600 text-center mb-8">
            {error || "Something went wrong with your payment. Please try again."}
          </p>
          
          <div className="w-full max-w-xs space-y-3">
            <Button 
              onClick={handleRetryPayment}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              Try Again
            </Button>
            <Button 
              onClick={handleBackToHome}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Simon
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
