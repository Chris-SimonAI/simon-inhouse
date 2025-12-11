import type { PaymentRequest, Stripe } from "@stripe/stripe-js";

export type PaymentRequestResult = {
  paymentRequest: PaymentRequest | null;
  canMakePayment: boolean;
};

type BuildPaymentRequestParams = {
  stripe: Stripe | null;
  amountCents: number;
  label?: string;
  /**
   * When true, we require Apple Pay and disable other wallets (Link/Google Pay).
   */
  requireApplePay?: boolean;
};

export async function buildPaymentRequest({
  stripe,
  amountCents,
  label = "Total",
  requireApplePay = false,
}: BuildPaymentRequestParams): Promise<PaymentRequestResult> {
  if (!stripe || !amountCents || amountCents <= 0) {
    return { paymentRequest: null, canMakePayment: false };
  }

  const paymentRequest = stripe.paymentRequest({
    country: "US",
    currency: "usd",
    total: {
      label,
      amount: amountCents,
    },
    requestPayerName: true,
    requestPayerEmail: true,
    requestPayerPhone: true,
    disableWallets: requireApplePay ? ["link", "googlePay"] : undefined,
  });

  const result = await paymentRequest.canMakePayment();
  const canUse = requireApplePay ? !!result?.applePay : !!result;
  if (!canUse) {
    return { paymentRequest: null, canMakePayment: false };
  }

  return {
    paymentRequest,
    canMakePayment: true,
  };
}

export async function getPaymentRequestAvailability(
  params: BuildPaymentRequestParams,
): Promise<PaymentRequestResult> {
  try {
    return await buildPaymentRequest(params);
  } catch (error) {
    console.error("Error preparing payment request:", error);
    return { paymentRequest: null, canMakePayment: false };
  }
}

export type PaymentRequestAvailability = {
  paymentRequest: PaymentRequest | null;
  canUseApplePay: boolean;
};

export async function checkPaymentRequestAvailability(
  stripe: Stripe | null,
  amountCents: number,
  label?: string,
  requireApplePay = false,
): Promise<PaymentRequestAvailability> {
  const { paymentRequest, canMakePayment } = await getPaymentRequestAvailability({
    stripe,
    amountCents,
    label,
    requireApplePay,
  });
  return {
    paymentRequest,
    canUseApplePay: canMakePayment,
  };
}

