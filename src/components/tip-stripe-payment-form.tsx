"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { stripePublishableKey } from "@/lib/stripe-client";
import { Button } from "@/components/ui/button";
import { CreditCard, Info, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";
import {
  createTipPaymentIntent,
  confirmTipPayment,
  getTipById,
  updateTipStatus,
} from "@/actions/tips";
import { cn } from "@/lib/utils";
import {
  validateFullName,
  validateNameOnCard,
  validateEmail,
} from "@/validations/card-payment";

type TipStripePaymentInnerProps = {
  tipId: number;
};

function TipStripePaymentInner({ tipId }: TipStripePaymentInnerProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const [nameOnCard, setNameOnCard] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    fullName?: string;
    nameOnCard?: string;
    email?: string;
  }>({});
  const handleClose = () => {
    if (!slug) return;
    router.push(hotelPath(slug, `/tip-staff`));
  };

  useEffect(() => {
    const init = async () => {
      try {
        const tipRes = await getTipById(tipId);
        if (!tipRes.ok || !tipRes.data) {
          setError("Tip not found");
          return;
        }
        const amt = Number.parseFloat(String(tipRes.data.amount));
        setAmount(Number.isFinite(amt) ? amt : 0);
        setCurrency(tipRes.data.currency || "USD");
        const pi = await createTipPaymentIntent({ tipId });
        if (!pi.ok || !pi.data) {
          setError("Failed to start payment");
          return;
        }
        setClientSecret(pi.data.clientSecret);
        setPaymentIntentId(pi.data.paymentIntentId);
      } catch (_e) {
        setError("Failed to initialize payment");
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [tipId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (!stripe || !elements || !clientSecret || isProcessing) return;

    const fullNameErr = validateFullName(fullName);
    const nameOnCardErr = validateNameOnCard(nameOnCard);
    const emailErr = validateEmail(email);
    const newErrors: {
      fullName?: string;
      nameOnCard?: string;
      email?: string;
    } = {};
    if (fullNameErr) newErrors.fullName = fullNameErr;
    if (nameOnCardErr) newErrors.nameOnCard = nameOnCardErr;
    if (emailErr) newErrors.email = emailErr;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsProcessing(true);
    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      const cardExpiryElement = elements.getElement(CardExpiryElement);
      const cardCvcElement = elements.getElement(CardCvcElement);
      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        throw new Error("Card elements not found");
      }

      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
          card: cardNumberElement,
          billing_details: {
            name: nameOnCard || undefined,
            email: email || undefined,
          },
        });
      if (pmError) {
        throw new Error(pmError.message);
      }

      if (!paymentIntentId) {
        throw new Error("Missing payment intent");
      }
      const confirmed = await confirmTipPayment({
        paymentIntentId,
        paymentMethodId: paymentMethod.id,
      });
      if (!confirmed.ok) {
        throw new Error("Payment confirmation failed");
      }

      router.push(hotelPath(slug, `/tip-staff/payment/${tipId}/processing`));
    } catch (err) {
      // Mark tip as failed immediately and route to failure page
      try {
        await updateTipStatus({ tipId, status: "failed" });
      } catch {
        // ignore
      }
      const failurePath = hotelPath(
        slug,
        `?tipping_failed=true&tipId=${tipId}`,
      );
      router.replace(failurePath);
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-center text-gray-700">Preparing payment…</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="p-6 text-center text-red-600 text-sm">
        {error || "Unable to load payment form"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Tip</h1>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 bg-[#f2f2f2] p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Payment Options
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="space-y-3">
            <div className="text-[14px] text-gray-900 mb-1">
              How would you like to pay by card?
            </div>
            <div className="flex items-center space-x-2 pl-2">
              <input
                type="radio"
                id="manual"
                name="paymentMethod"
                value="manual"
                defaultChecked
                className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
              />
              <label
                htmlFor="manual"
                className="text-base font-medium text-gray-900"
              >
                Enter card details manually
              </label>
            </div>
          </div>
        </div>

        {/* Pay now with card + total */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Pay now with card
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-base text-gray-900">Total</span>
            <span className="text-lg font-semibold text-gray-900">
              ${amount.toFixed(2)} {currency.toUpperCase()}
            </span>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Card Details
        </h2>
        <div className="bg-white px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="fullName"
                  className="text-sm font-medium text-gray-700"
                >
                  Full Name
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  const value = e.target.value;
                  setFullName(value);
                  const err = validateFullName(value);
                  setErrors((prev) => ({
                    ...prev,
                    fullName: err || undefined,
                  }));
                }}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.fullName &&
                    "border-red-500 focus:ring-red-500 focus:border-red-500",
                )}
                placeholder="Enter full name"
                autoComplete="name"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  const err = validateEmail(value);
                  setErrors((prev) => ({ ...prev, email: err || undefined }));
                }}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.email &&
                    "border-red-500 focus:ring-red-500 focus:border-red-500",
                )}
                placeholder="you@example.com"
                inputMode="email"
                autoComplete="email"
                required
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Name on Card
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                value={nameOnCard}
                onChange={(e) => {
                  const value = e.target.value;
                  setNameOnCard(value);
                  const err = validateNameOnCard(value);
                  setErrors((prev) => ({
                    ...prev,
                    nameOnCard: err || undefined,
                  }));
                }}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.nameOnCard &&
                    "border-red-500 focus:ring-red-500 focus:border-red-500",
                )}
                placeholder="Full name"
                required
                autoComplete="cc-name"
              />
              {errors.nameOnCard && (
                <p className="mt-1 text-xs text-red-600">{errors.nameOnCard}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Card Number
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <div className="px-10 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-gray-900">
                  <CardNumberElement
                    options={{
                      style: {
                        base: {
                          fontSize: "14px",
                          color: "#374151",
                          fontFamily: "system-ui, sans-serif",
                          "::placeholder": { color: "#9CA3AF" },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Expiration Date
                </label>
                <div className="px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-gray-900">
                  <CardExpiryElement
                    options={{
                      style: {
                        base: {
                          fontSize: "14px",
                          color: "#374151",
                          fontFamily: "system-ui, sans-serif",
                          "::placeholder": { color: "#9CA3AF" },
                        },
                      },
                      placeholder: "MM/YY",
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Security Code
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                    <Info className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="px-10 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-gray-900">
                    <CardCvcElement
                      options={{
                        style: {
                          base: {
                            fontSize: "14px",
                            color: "#374151",
                            fontFamily: "system-ui, sans-serif",
                            "::placeholder": { color: "#9CA3AF" },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-[2px] py-7 text-base font-semibold flex items-center justify-center"
              size="lg"
            >
              {isProcessing ? "Processing…" : `Tip $${amount.toFixed(2)}`}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

type TipStripePaymentFormProps = {
  tipId: number;
};

export function TipStripePaymentForm({ tipId }: TipStripePaymentFormProps) {
  const [stripe, setStripe] = useState<Awaited<
    ReturnType<typeof loadStripe>
  > | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!stripePublishableKey) return;
      const s = await loadStripe(stripePublishableKey);
      setStripe(s);
    };
    void init();
  }, []);

  if (!stripe) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-center text-gray-700">Loading payment form…</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripe}>
      <TipStripePaymentInner tipId={tipId} />
    </Elements>
  );
}
