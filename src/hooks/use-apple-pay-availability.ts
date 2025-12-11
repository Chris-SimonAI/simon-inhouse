import { useEffect, useState } from "react";
import type { PaymentRequest, Stripe } from "@stripe/stripe-js";
import { checkPaymentRequestAvailability } from "@/lib/payments/payment-request";

type Options = {
  stripeOrPromise: Stripe | null | Promise<Stripe | null>;
  amountCents: number;
  label?: string;
  requireApplePay?: boolean;
};

export function useApplePayAvailability({
  stripeOrPromise,
  amountCents,
  label = "Total",
  requireApplePay = false,
}: Options) {
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canUseApplePay, setCanUseApplePay] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!stripeOrPromise || !amountCents || amountCents <= 0) {
        setCanUseApplePay(false);
        setPaymentRequest(null);
        return;
      }
      setIsChecking(true);
      try {
        const stripe = await Promise.resolve(stripeOrPromise);
        if (!stripe) {
          if (!cancelled) {
            setCanUseApplePay(false);
            setPaymentRequest(null);
          }
          return;
        }
        const { paymentRequest: pr, canUseApplePay: available } =
          await checkPaymentRequestAvailability(stripe, amountCents, label, requireApplePay);
        if (cancelled) return;
        setPaymentRequest(pr);
        setCanUseApplePay(available);
      } catch (error) {
        if (cancelled) return;
        console.error("Apple Pay availability check failed:", error);
        setPaymentRequest(null);
        setCanUseApplePay(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [amountCents, label, requireApplePay, stripeOrPromise]);

  return { paymentRequest, canUseApplePay, isChecking };
}
