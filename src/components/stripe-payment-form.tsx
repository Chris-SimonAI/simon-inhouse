'use client';

import { useState, useEffect, useId, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Lock, Info, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createSecureOrderAndPaymentIntent, confirmPayment } from '@/actions/payments';
import { redeemDiscount } from '@/actions/dining-discounts';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePublishableKey } from '@/lib/stripe-client';
import { useHotelSlug } from '@/hooks/use-hotel-slug';
import { hotelPath } from '@/utils/hotel-path';
import { ConfirmExitButton } from '@/components/confirm-exit-button';
import { clearCheckoutState } from '@/utils/clear-checkout-state';
import type { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { useApplePayAvailability } from '@/hooks/use-apple-pay-availability';
import {
  loadPaymentDetails,
  loadPaymentMethod,
  markPaymentAsProcessing,
  resetPaymentStatusToPending,
  savePaymentDetails,
  savePaymentMethod,
} from '@/lib/payments/storage';
import type { PaymentMethod } from '@/lib/payments/totals';
import { 
  type CardPaymentForm,
  validateCardPayment,
  validateRoomNumber,
  validateFullName,
  validateNameOnCard,
  validateEmail,
} from '@/validations/card-payment';
import type { TipOption, SecureOrderItem } from '@/validations/dine-in-orders';
import { isValidPhoneNumber } from 'react-phone-number-input';

type CartItem = {
  selectedModifiers: Record<string, string[]>;
  menuItem: {
    id: string; // This is menuItemGuid from database
    name: string;
    description: string;
    price: number;
    modifierGroups: Array<{
      id: string;
      name: string;
      options: Array<{
        id: string;
        name: string;
        price: number;
      }>;
    }>;
  };
  quantity: number;
};

type StripePaymentFormProps = {
  restaurantGuid: string;
  total: number;
};

// Inner component that uses Stripe Elements
function PaymentForm({ restaurantGuid, total }: StripePaymentFormProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [storedApplePayAvailable, setStoredApplePayAvailable] = useState<boolean | null>(null);

  const debugId = useId();

  // Form state
  const [roomNumber, setRoomNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof CardPaymentForm, string>>
  >({});

  const roomNumberId = useId();
  const fullNameId = useId();
  const emailId = useId();
  const phoneNumberId = useId();
  const nameOnCardId = useId();

  // Restore preferred payment method from prior screen
  useEffect(() => {
    const storedMethod = loadPaymentMethod(restaurantGuid);
    if (storedMethod) {
      setPaymentMethod(storedMethod);
    }

    const paymentDetails = loadPaymentDetails(restaurantGuid);
    if (paymentDetails?.paymentMethod) {
      setPaymentMethod(paymentDetails.paymentMethod);
    }
    if (paymentDetails?.canUseApplePay !== undefined) {
      setStoredApplePayAvailable(paymentDetails.canUseApplePay);
    }
  }, [restaurantGuid]);

  useEffect(() => {
    savePaymentMethod(restaurantGuid, paymentMethod);
  }, [paymentMethod, restaurantGuid]);

  const amountCents = Math.max(50, Math.round(total * 100));

  const { paymentRequest, canUseApplePay: hookCanUseApplePay } = useApplePayAvailability({
    stripeOrPromise: useMemo(() => stripe ?? null, [stripe]),
    amountCents,
    label: 'Total',
    requireApplePay: true,
  });

  const effectiveCanUseApplePay =
    storedApplePayAvailable === null ? hookCanUseApplePay : storedApplePayAvailable;

  useEffect(() => {
    if (!effectiveCanUseApplePay && paymentMethod === 'applePay') {
      setPaymentMethod('card');
      setPaymentNotice('Apple Pay is not available on this device. Switched to card.');
    } else {
      setPaymentNotice(null);
    }
  }, [effectiveCanUseApplePay, paymentMethod]);

  const handleRoomNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRoomNumber(value);
    const error = validateRoomNumber(value);
    setErrors(prev => ({ ...prev, roomNumber: error || undefined }));
  };

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFullName(value);
    const error = validateFullName(value);
    setErrors(prev => ({ ...prev, fullName: error || undefined }));
  };

  const handleNameOnCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNameOnCard(value);
    const error = validateNameOnCard(value);
    setErrors(prev => ({ ...prev, nameOnCard: error || undefined }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    const error = validateEmail(value);
    setErrors(prev => ({ ...prev, email: error || undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    // Validate phone at submit time only
    const nationalDigits = phoneNumber.replace(/^\+1/, '').replace(/\D/g, '');
    const e164 = `+1${nationalDigits}`; // currently hardcoded to US
    const phoneIsValid = e164 ? isValidPhoneNumber(e164) && nationalDigits.length === 10 : false;
    if (!phoneIsValid) {
      setErrors(prev => ({ ...prev, phoneNumber: 'Enter a valid phone number' }));
      return;
    }

    const formData: CardPaymentForm = {
      roomNumber,
      fullName,
      nameOnCard,
      email,
      phoneNumber: nationalDigits,
    };

    const validation = validateCardPayment(formData);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof CardPaymentForm, string>> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof CardPaymentForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    const validatedForm = validation.data;

    if (isProcessing || !stripe || !elements) return;
    setIsProcessing(true);

    try {
      console.log("[stripe][checkout][card] submit:start", {
        debugId,
        restaurantGuid,
        total,
        amountCents,
        slug: slug ?? null,
        hasStripe: Boolean(stripe),
        hasElements: Boolean(elements),
        paymentMethod,
        roomNumber: roomNumber || null,
        fullNameProvided: Boolean(fullName),
        nameOnCardProvided: Boolean(nameOnCard),
        email,
        phoneNumber,
      });

      const paymentDetails = markPaymentAsProcessing(restaurantGuid);
      
      // 1. Prepare SECURE order items (only IDs and quantities - NO PRICES)
      // All prices are calculated server-side from database lookups
      const secureOrderItems: SecureOrderItem[] = paymentDetails.cart.map((item: CartItem) => ({
        menuItemGuid: item.menuItem.id, // This is the UUID
        quantity: item.quantity,
        selectedModifiers: item.selectedModifiers,
      }));

      // 2. Get tipOption from payment details (set by payment-view.tsx)
      const tipOption: TipOption = paymentDetails.tipOption || { type: 'fixed', value: 0 };

      console.log("[stripe][checkout][card] order:create:payload", {
        debugId,
        restaurantGuid,
        itemCount: secureOrderItems.length,
        items: secureOrderItems.map((it) => ({
          menuItemGuid: it.menuItemGuid,
          quantity: it.quantity,
          selectedModifierGroupCount: Object.keys(it.selectedModifiers || {}).length,
          selectedModifierOptionCount: Object.values(it.selectedModifiers || {}).reduce(
            (sum, arr) => sum + arr.length,
            0,
          ),
        })),
        roomNumber: validatedForm.roomNumber,
        fullNameProvided: Boolean(validatedForm.fullName),
        email: validatedForm.email,
        phoneNumber: validatedForm.phoneNumber,
        tipOption,
      });

      // 3. Create SECURE order + Stripe payment intent
      // Server calculates all prices from database - client prices are NOT trusted
      const orderResult = await createSecureOrderAndPaymentIntent({
        restaurantGuid: restaurantGuid,
        roomNumber: validatedForm.roomNumber,
        fullName: validatedForm.fullName,
        specialInstructions: "Please deliver to room",
        email: validatedForm.email,
        phoneNumber: validatedForm.phoneNumber,
        items: secureOrderItems,
        tipOption: tipOption,
      });

      if (!orderResult.ok) {
        console.error("[stripe][checkout][card] order:create:failed", {
          debugId,
          restaurantGuid,
          message: orderResult.message ?? "Unknown error",
        });
        throw new Error('Failed to create order and payment intent');
      }

      console.log('Processing payment with Stripe Elements...', {
        amount: total,
        paymentIntentId: orderResult.data.paymentIntentId,
      });

      console.log("[stripe][checkout][card] order:create:success", {
        debugId,
        restaurantGuid,
        orderId: orderResult.data.order?.id,
        paymentIntentId: orderResult.data.paymentIntentId,
        hasClientSecret: Boolean(orderResult.data.clientSecret),
        calculation: orderResult.data.calculation
          ? {
              subtotal: orderResult.data.calculation.subtotal,
              serviceFee: orderResult.data.calculation.serviceFee,
              deliveryFee: orderResult.data.calculation.deliveryFee,
              discount: orderResult.data.calculation.discount,
              discountPercentage: orderResult.data.calculation.discountPercentage,
              tip: orderResult.data.calculation.tip,
              total: orderResult.data.calculation.total,
            }
          : null,
      });

      // 2. Create Payment Method using Stripe Elements
      const cardNumberElement = elements.getElement(CardNumberElement);
      const cardExpiryElement = elements.getElement(CardExpiryElement);
      const cardCvcElement = elements.getElement(CardCvcElement);

      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        console.error("[stripe][checkout][card] elements:missing", {
          debugId,
          hasCardNumberElement: Boolean(cardNumberElement),
          hasCardExpiryElement: Boolean(cardExpiryElement),
          hasCardCvcElement: Boolean(cardCvcElement),
        });
        throw new Error('Card elements not found');
      }

      console.log("[stripe][checkout][card] paymentMethod:create:start", {
        debugId,
        card: cardNumberElement,
        billingDetails: {
          nameProvided: Boolean(nameOnCard),
          email,
          phone: nationalDigits,
        },
      });

      const { error: stripeError, paymentMethod: createdPaymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
        billing_details: {
          name: nameOnCard,
          email: email,
          phone: nationalDigits,
        },
      });

      if (stripeError) {
        console.error("[stripe][checkout][card] paymentMethod:create:error", {
          debugId,
          stripeError: {
            type: stripeError.type,
            code: (stripeError as unknown as { code?: string }).code,
            message: stripeError.message,
          },
        });
        throw new Error(stripeError.message);
      }

      console.log("[stripe][checkout][card] paymentMethod:create:success", {
        debugId,
        paymentMethodId: createdPaymentMethod.id,
        type: createdPaymentMethod.type,
        card: createdPaymentMethod.card
          ? {
              brand: createdPaymentMethod.card.brand,
              country: createdPaymentMethod.card.country ?? null,
              funding: createdPaymentMethod.card.funding ?? null,
              last4: createdPaymentMethod.card.last4 ?? null,
              expMonth: createdPaymentMethod.card.exp_month ?? null,
              expYear: createdPaymentMethod.card.exp_year ?? null,
            }
          : null,
      });

      // 3. Confirm payment with Payment Method
      console.log("[stripe][checkout][card] paymentIntent:confirm:request", {
        debugId,
        paymentIntentId: orderResult.data.paymentIntentId,
        paymentMethodId: createdPaymentMethod.id,
      });

      const confirmResult = await confirmPayment({
        paymentIntentId: orderResult.data.paymentIntentId,
        paymentMethodId: createdPaymentMethod.id,
      });

      if (!confirmResult.ok) {
        console.error("[stripe][checkout][card] paymentIntent:confirm:failed", {
          debugId,
          paymentIntentId: orderResult.data.paymentIntentId,
          paymentMethodId: createdPaymentMethod.id,
          message: confirmResult.message ?? "Unknown error",
        });
        throw new Error('Payment confirmation failed');
      }

      console.log("[stripe][checkout][card] paymentIntent:confirm:success", {
        debugId,
        paymentIntentId: orderResult.data.paymentIntentId,
        paymentMethodId: createdPaymentMethod.id,
        paymentRecord: confirmResult.data?.payment
          ? {
              id: confirmResult.data.payment.id,
              orderId: confirmResult.data.payment.orderId,
              status: confirmResult.data.payment.paymentStatus,
              stripePaymentIntentId: confirmResult.data.payment.stripePaymentIntentId,
            }
          : null,
      });

      // 4. Mark payment as completed and redirect to success
      const completedDetails = {
        ...paymentDetails,
        status: 'completed' as const,
        orderId: orderResult.data.order.id,
        paymentId: confirmResult.data.payment.id,
        email: validatedForm.email,
        phoneNumber: validatedForm.phoneNumber,
      };
      savePaymentDetails(restaurantGuid, completedDetails);
      
      // 5. Redeem discount if one was applied (uses session internally)
      if (paymentDetails.discountPercentage > 0) {
        await redeemDiscount();
      }
      
      // Clear cart
      localStorage.removeItem(`cart-${restaurantGuid}`);
      localStorage.removeItem(`tip-selection-${restaurantGuid}`);
      localStorage.removeItem(`payment-session-${restaurantGuid}`);
      
      // Note: Order is still 'pending' until webhook confirms payment
      const successPath = slug
        ? `${hotelPath(slug)}?orderSuccess=true&orderId=${orderResult.data.order.id}&paymentId=${confirmResult.data.payment.id}&status=processing`
        : `/?orderSuccess=true&orderId=${orderResult.data.order.id}&paymentId=${confirmResult.data.payment.id}&status=processing`;
      router.push(successPath);
      
    } catch (err) {
      console.error('Payment error:', err);
      
      // Reset payment status to pending on error (allow retry)
      resetPaymentStatusToPending(restaurantGuid);
      
      setError(err instanceof Error ? err.message : 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmExit = () => {
    clearCheckoutState(restaurantGuid);
    const path = hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/menu`);
    if (!path) return;
    router.push(path);
  }  // Handle Payment Request (Apple Pay) submission
  useEffect(() => {
    if (!paymentRequest) return;

    const handlePaymentRequestEvent = async (ev: PaymentRequestPaymentMethodEvent) => {
      setPaymentMethod('applePay');
      setErrors({});
      setError(null);

      console.log("[stripe][checkout][applePay] paymentRequest:event", {
        debugId,
        restaurantGuid,
        paymentMethodId: ev.paymentMethod?.id ?? null,
        hasShippingAddress: Boolean((ev as unknown as { shippingAddress?: unknown }).shippingAddress),
        hasPayerName: Boolean((ev as unknown as { payerName?: unknown }).payerName),
        hasPayerEmail: Boolean((ev as unknown as { payerEmail?: unknown }).payerEmail),
        hasPayerPhone: Boolean((ev as unknown as { payerPhone?: unknown }).payerPhone),
      });

    const fieldErrors: Partial<Record<keyof CardPaymentForm, string>> = {};
    const roomError = validateRoomNumber(roomNumber);
    const fullNameError = validateFullName(fullName);
    const emailError = validateEmail(email);

    if (roomError) fieldErrors.roomNumber = roomError;
    if (fullNameError) fieldErrors.fullName = fullNameError;
    if (emailError) fieldErrors.email = emailError;

    const hasErrors = Object.values(fieldErrors).some(Boolean);
    if (hasErrors) {
      setErrors(fieldErrors);
      ev.complete('fail');
      return;
    }

    const validatedForm = {
      roomNumber,
      fullName,
      nameOnCard,
      email,
      phoneNumber,
    };

      if (isProcessing) {
        ev.complete('fail');
        return;
      }

      setIsProcessing(true);

      try {
        const paymentDetails = markPaymentAsProcessing(restaurantGuid);

        const secureOrderItems: SecureOrderItem[] = paymentDetails.cart.map((item: CartItem) => ({
          menuItemGuid: item.menuItem.id,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
        }));

        const tipOption: TipOption = paymentDetails.tipOption || { type: 'fixed', value: 0 };

        const orderResult = await createSecureOrderAndPaymentIntent({
          restaurantGuid: restaurantGuid,
          roomNumber: validatedForm.roomNumber,
          fullName: validatedForm.fullName,
          specialInstructions: "Please deliver to room",
          email: validatedForm.email,
          phoneNumber: validatedForm.phoneNumber,
          items: secureOrderItems,
          tipOption: tipOption,
        });

        if (!orderResult.ok) {
          console.error("[stripe][checkout][applePay] order:create:failed", {
            debugId,
            restaurantGuid,
            message: orderResult.message ?? "Unknown error",
          });
          throw new Error('Failed to create order and payment intent');
        }

        console.log("[stripe][checkout][applePay] order:create:success", {
          debugId,
          restaurantGuid,
          orderId: orderResult.data.order?.id,
          paymentIntentId: orderResult.data.paymentIntentId,
          hasClientSecret: Boolean(orderResult.data.clientSecret),
        });

        const paymentMethodId = ev.paymentMethod?.id;
        if (!paymentMethodId) {
          console.error("[stripe][checkout][applePay] paymentMethod:missing", { debugId });
          throw new Error('Payment method not available');
        }

        console.log("[stripe][checkout][applePay] paymentIntent:confirm:request", {
          debugId,
          paymentIntentId: orderResult.data.paymentIntentId,
          paymentMethodId,
        });

        const confirmResult = await confirmPayment({
          paymentIntentId: orderResult.data.paymentIntentId,
          paymentMethodId,
        });

        if (!confirmResult.ok) {
          console.error("[stripe][checkout][applePay] paymentIntent:confirm:failed", {
            debugId,
            paymentIntentId: orderResult.data.paymentIntentId,
            paymentMethodId,
            message: confirmResult.message ?? "Unknown error",
          });
          throw new Error('Payment confirmation failed');
        }

        console.log("[stripe][checkout][applePay] paymentIntent:confirm:success", {
          debugId,
          paymentIntentId: orderResult.data.paymentIntentId,
          paymentMethodId,
          paymentRecord: confirmResult.data?.payment
            ? {
                id: confirmResult.data.payment.id,
                orderId: confirmResult.data.payment.orderId,
                status: confirmResult.data.payment.paymentStatus,
                stripePaymentIntentId: confirmResult.data.payment.stripePaymentIntentId,
              }
            : null,
        });

        const completedDetails = {
          ...paymentDetails,
          status: 'completed' as const,
          orderId: orderResult.data.order.id,
          paymentId: confirmResult.data.payment.id,
          email: validatedForm.email,
          phoneNumber: validatedForm.phoneNumber,
        };
        savePaymentDetails(restaurantGuid, completedDetails);

        if (paymentDetails.discountPercentage > 0) {
          await redeemDiscount();
        }

        localStorage.removeItem(`cart-${restaurantGuid}`);
        localStorage.removeItem(`tip-selection-${restaurantGuid}`);
        localStorage.removeItem(`payment-session-${restaurantGuid}`);

        const successPath = slug
          ? `${hotelPath(slug)}?orderSuccess=true&orderId=${orderResult.data.order.id}&paymentId=${confirmResult.data.payment.id}&status=processing`
          : `/?orderSuccess=true&orderId=${orderResult.data.order.id}&paymentId=${confirmResult.data.payment.id}&status=processing`;

        ev.complete('success');
        router.push(successPath);
      } catch (err) {
        console.error('Payment request error:', err);
        resetPaymentStatusToPending(restaurantGuid);
        setError(err instanceof Error ? err.message : 'Payment processing failed. Please try again.');
        ev.complete('fail');
      } finally {
        setIsProcessing(false);
      }
    };

    paymentRequest.on('paymentmethod', handlePaymentRequestEvent);
    return () => {
      paymentRequest.off('paymentmethod', handlePaymentRequestEvent);
    };
  }, [
    amountCents,
    debugId,
    email,
    fullName,
    isProcessing,
    nameOnCard,
    paymentRequest,
    phoneNumber,
    restaurantGuid,
    roomNumber,
    router,
    slug,
    total,
  ]);

  return (
    <div className="flex flex-col h-dvh bg-gray-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href={slug ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/payment`) : '#'}
            className="flex items-center gap-2 text-gray-900"
            aria-label="Back to Payment Method"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-base font-semibold">Menu</span>
          </Link>

          <ConfirmExitButton
            title="Leave payment?"
            description="Leaving now will clear your cart and return you to the restaurant menu. Continue?"
            onConfirm={handleConfirmExit}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 bg-[#f2f2f2] p-4">
        {/* Payment Summary */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Payment Method
        </h2>
        <div className="bg-white px-4 py-6 mb-2 space-y-2">
          <div className="text-[14px] text-gray-900">
            {paymentMethod === 'applePay' ? 'Apple Pay / Wallet' : 'Card payment'}
          </div>
          {paymentNotice && (
            <p className="text-xs text-red-600">{paymentNotice}</p>
          )}
        </div>

        {/* Pay Now Section */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Pay now
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base text-gray-900">Total</span>
              <span className="text-lg font-semibold text-gray-900">${total.toFixed(2)} USD</span>
            </div>
            <p className="text-xs text-gray-500">
              Please enter your details below. We will only use this information to contact you about your order and for no other purpose.
            </p>
          </div>
        </div>

        {/* Form */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Payment Details
        </h2>
        <div className="bg-white px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Room Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={roomNumberId} className="text-sm font-medium text-gray-700">
                  Room Number
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                id={roomNumberId}
                value={roomNumber}
                onChange={handleRoomNumberChange}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.roomNumber && "border-red-500 focus:ring-red-500 focus:border-red-500"
                )}
                placeholder="Enter room number"
              />
              {errors.roomNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.roomNumber}</p>
              )}
            </div>

            {/* Full Name */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={fullNameId} className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                id={fullNameId}
                value={fullName}
                onChange={handleFullNameChange}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.fullName && "border-red-500 focus:ring-red-500 focus:border-red-500"
                )}
                placeholder="Enter full name"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={emailId} className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="email"
                id={emailId}
                value={email}
                onChange={handleEmailChange}
                className={cn(
                  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                  errors.email && "border-red-500 focus:ring-red-500 focus:border-red-500"
                )}
                placeholder="Enter email"
                inputMode="email"
                autoComplete="email"
                required
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={phoneNumberId} className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10 select-none text-gray-500 text-sm">
                  +1
                </div>
                <input

                  id={phoneNumberId}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className={cn(
                    "w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                    errors.phoneNumber && "border-red-500 focus:ring-red-500 focus:border-red-500"
                  )}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.phoneNumber}</p>
              )}
            </div>

            {/* Name on Card (card-only) */}
            {paymentMethod !== 'applePay' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor={nameOnCardId} className="text-sm font-medium text-gray-700">
                    Name on Card
                  </label>
                  <span className="text-xs text-red-500">Required</span>
                </div>
                <input
                  type="text"
                  id={nameOnCardId}
                  value={nameOnCard}
                  onChange={handleNameOnCardChange}
                  className={cn(
                    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                    errors.nameOnCard && "border-red-500 focus:ring-red-500 focus:border-red-500"
                  )}
                  placeholder="Enter name as it appears on card"
                />
                {errors.nameOnCard && (
                  <p className="mt-1 text-xs text-red-600">{errors.nameOnCard}</p>
                )}
              </div>
            )}

            {paymentMethod === 'applePay' && effectiveCanUseApplePay && paymentRequest ? (
              <div className="space-y-3">
                <PaymentRequestButtonElement
                  options={{
                    paymentRequest,
                    style: { paymentRequestButton: { type: 'default', height: '44px' } },
                  }}
                />
                <p className="text-xs text-gray-600">
                  Use Apple Pay to complete your payment securely.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Card Number
                  </p>
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
                              fontSize: '14px',
                              color: '#374151',
                              fontFamily: 'system-ui, sans-serif',
                              '::placeholder': {
                                color: '#9CA3AF',
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Expiration Date
                    </p>
                    <div className="px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-gray-900">
                      <CardExpiryElement
                        options={{
                          style: {
                            base: {
                              fontSize: '14px',
                              color: '#374151',
                              fontFamily: 'system-ui, sans-serif',
                              '::placeholder': {
                                color: '#9CA3AF',
                              },
                            },
                          },
                          placeholder: 'MM/YY',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Security Code
                    </p>
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
                                fontSize: '14px',
                                color: '#374151',
                                fontFamily: 'system-ui, sans-serif',
                                '::placeholder': {
                                  color: '#9CA3AF',
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-[2px] py-7 text-base font-semibold flex items-center justify-center"
                  size="lg"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing Payment...</span>
                    </div>
                  ) : (
                    `Pay $${total.toFixed(2)}`
                  )}
                </Button>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </form>
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

// Main component that wraps with Stripe Elements
export default function StripePaymentForm({ restaurantGuid, total }: StripePaymentFormProps) {
  const [stripe, setStripe] = useState<Awaited<ReturnType<typeof loadStripe>> | null>(null);

  // Initialize Stripe
  useEffect(() => {
    const initializeStripe = async () => {
      if (!stripePublishableKey) {
        console.error('Stripe publishable key is not available');
        return;
      }
      const stripeInstance = await loadStripe(stripePublishableKey);
      setStripe(stripeInstance);
    };
    initializeStripe();
  }, []);

  if (!stripe) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">Menu</h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payment form...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripe}>
      <PaymentForm restaurantGuid={restaurantGuid} total={total} />
    </Elements>
  );
}
