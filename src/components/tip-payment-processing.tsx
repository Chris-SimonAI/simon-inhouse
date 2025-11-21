"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTipById } from "@/actions/tips";
import { Loader2 } from "lucide-react";

type TipPaymentProcessingProps = {
  tipId: number;
  onSuccessPath: string;
  onFailurePath: string;
  pollMs?: number;
  timeoutMs?: number;
};

export function TipPaymentProcessing({
  tipId,
  onSuccessPath,
  onFailurePath,
  pollMs = 2000,
  timeoutMs = 120000,
}: TipPaymentProcessingProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "completed" | "failed">(
    "processing",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const res = await getTipById(tipId);
        if (!mounted) return;
        if (!res.ok || !res.data) {
          setError("Unable to fetch tip status");
          return;
        }
        const s = res.data.paymentStatus as "pending" | "completed" | "failed";
        if (s === "completed") {
          setStatus("completed");
          if (timer) clearInterval(timer);
          if (timeout) clearTimeout(timeout);
          router.replace(onSuccessPath);
        } else if (s === "failed") {
          setStatus("failed");
          if (timer) clearInterval(timer);
          if (timeout) clearTimeout(timeout);
          router.replace(onFailurePath);
        }
      } catch {
        if (mounted) setError("Network error; retrying…");
      }
    };

    timer = setInterval(check, pollMs);
    // also run immediately
    void check();
    timeout = setTimeout(() => {
      if (!mounted) return;
      if (timer) clearInterval(timer);
      setError("Taking longer than expected. We will update once complete.");
    }, timeoutMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (timeout) clearTimeout(timeout);
    };
  }, [tipId, pollMs, timeoutMs, router, onSuccessPath, onFailurePath]);

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {status === "failed"
            ? "Payment Failed"
            : status === "completed"
              ? "Payment Confirmed"
              : "Processing Payment"}
        </h1>
        <p className="text-gray-600 text-center mb-8">
          {status === "failed"
            ? "We could not process your tip. Please try again."
            : status === "completed"
              ? "Your tip has been processed successfully."
              : "Please wait while we process your tip payment. This may take a few moments."}
        </p>

        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>{status === "failed" ? "Status" : "Processing"}</span>
            <span>
              {status === "failed"
                ? "Failed"
                : status === "completed"
                  ? "Done"
                  : "Please wait..."}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${status === "failed" ? "bg-red-600" : status === "completed" ? "bg-green-600" : "bg-blue-600"} ${status === "processing" ? "animate-pulse" : ""}`}
              style={{ width: status === "processing" ? "60%" : "100%" }}
            ></div>
          </div>
          {error && (
            <p className="text-xs text-gray-500 mt-3 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
