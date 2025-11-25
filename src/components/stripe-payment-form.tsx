'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, CreditCard, Lock, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createOrderAndPaymentIntent, confirmPayment } from '@/actions/payments';
import { getDineInRestaurantByGuid } from '@/actions/dine-in-restaurants';
import { redeemDiscount } from '@/actions/dining-discounts';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePublishableKey } from '@/lib/stripe-client';
import { useHotelSlug } from '@/hooks/use-hotel-slug';
import { hotelPath } from '@/utils/hotel-path';
import { 
  type CardPaymentForm,
  validateCardPayment,
  validateRoomNumber,
  validateFullName,
    validateNameOnCard,
    validateEmail,
    validatePhoneNumber
} from '@/validations/card-payment';

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

// Helper function to calculate modifier price
const calculateModifierPrice = (item: CartItem) => {
  let modifierTotal = 0;
  
  Object.entries(item.selectedModifiers).forEach(([groupId, optionIds]) => {
    const group = item.menuItem.modifierGroups.find((g) => g.id === groupId);
    if (group && (optionIds as string[]).length > 0) {
      (optionIds as string[]).forEach((optionId: string) => {
        const option = group.options.find((o) => o.id === optionId);
        if (option) {
          modifierTotal += option.price;
        }
      });
    }
  });
  
  return Math.round(modifierTotal * 100) / 100;
};

// Helper function to transform modifier details
const transformModifierDetails = (item: CartItem) => {
  const modifierDetails: Array<{
    groupId: string;
    groupName: string;
    options: Array<{
      optionId: string;
      optionName: string;
      optionPrice: string;
    }>;
  }> = [];

  Object.entries(item.selectedModifiers).forEach(([groupId, optionIds]) => {
    const group = item.menuItem.modifierGroups.find((g) => g.id === groupId);
    if (group && (optionIds as string[]).length > 0) {
        const selectedOptions = (optionIds as string[])
          .map((optionId: string) => {
            const option = group.options.find((o) => o.id === optionId);
            return option ? {
              optionId: option.id,
              optionName: option.name,
              optionPrice: option.price.toFixed(2)
            } : null;
          })
          .filter((option): option is NonNullable<typeof option> => option !== null);

      if (selectedOptions.length > 0) {
        modifierDetails.push({
          groupId: group.id,
          groupName: group.name,
          options: selectedOptions
        });
      }
    }
  });

  return modifierDetails;
};

// Inner component that uses Stripe Elements
function PaymentForm({ restaurantGuid, total }: StripePaymentFormProps) {
  const router = useRouter();
  const slug = useHotelSlug();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [roomNumber, setRoomNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof CardPaymentForm, string>>
  >({});

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

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhoneNumber(value);
    const error = validatePhoneNumber(value);
    setErrors(prev => ({ ...prev, phoneNumber: error || undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    const formData: CardPaymentForm = {
      roomNumber,
      fullName,
      nameOnCard,
      email,
      phoneNumber,
    };

    const result = validateCardPayment(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CardPaymentForm, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof CardPaymentForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (isProcessing || !stripe || !elements) return;
    setIsProcessing(true);

    try {
      // Get payment details from localStorage
      const paymentDetailsStr = localStorage.getItem(`payment-details-${restaurantGuid}`);
      if (!paymentDetailsStr) {
        throw new Error('Payment session not found. Please start over.');
      }
      
      const paymentDetails = JSON.parse(paymentDetailsStr);
      
      // Check if payment is already completed
      if (paymentDetails.status === 'completed') {
        throw new Error('Payment already completed.');
      }
      
      // Check if payment is already being processed
      if (paymentDetails.status === 'processing') {
        throw new Error('Payment is already being processed. Please wait.');
      }
      
      // Check session age (5 minutes max)
      const sessionAge = Date.now() - paymentDetails.timestamp;
      if (sessionAge > 5 * 60 * 1000) {
        throw new Error('Payment session expired. Please start over.');
      }
      
      // Check attempt limit (max 3 attempts)
      if (paymentDetails.attempts >= 3) {
        throw new Error('Maximum payment attempts exceeded. Please start over.');
      }
      
      // Update status to processing and increment attempts
      paymentDetails.status = 'processing';
      paymentDetails.attempts = (paymentDetails.attempts || 0) + 1;
      localStorage.setItem(`payment-details-${restaurantGuid}`, JSON.stringify(paymentDetails));
      
      // 1. Prepare order items (server will handle UUID to database ID conversion)
      const orderItems = paymentDetails.cart.map((item: CartItem) => {
        const modifierPrice = calculateModifierPrice(item);
        const unitPrice = item.menuItem.price + modifierPrice;
        
        return {
          menuItemId: 0, // Will be set by server after UUID lookup
          menuItemGuid: item.menuItem.id, // This is the UUID
          itemName: item.menuItem.name,
          itemDescription: item.menuItem.description,
          basePrice: item.menuItem.price.toFixed(2),
          modifierPrice: modifierPrice.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          quantity: item.quantity,
          totalPrice: (unitPrice * item.quantity).toFixed(2),
          modifierDetails: transformModifierDetails(item)
        };
      });

      // Resolve restaurant and hotel IDs from restaurantGuid
      const restaurantLookup = await getDineInRestaurantByGuid(restaurantGuid);
      if (!restaurantLookup.ok || !restaurantLookup.data) {
        throw new Error('Restaurant not found');
      }
      const restaurantId = restaurantLookup.data.id as number;
      const hotelId = restaurantLookup.data.hotelId as number;

      // 2. Create order + Stripe payment intent
      const orderResult = await createOrderAndPaymentIntent({
        hotelId: hotelId,
        restaurantId: restaurantId,
        userId: 123, // Hardcoded for testing
        roomNumber: roomNumber,
        fullName: fullName,
        specialInstructions: "Please deliver to room",
        email: email,
        phoneNumber: phoneNumber,
        items: orderItems,
        subtotal: paymentDetails.subtotal,
        discount: paymentDetails.discount,
        discountPercentage: paymentDetails.discountPercentage,
        tax: paymentDetails.tax,
        tip: paymentDetails.tip,
        total: paymentDetails.total,
      });

      if (!orderResult.ok) {
        throw new Error('Failed to create order and payment intent');
      }

      console.log('Processing payment with Stripe Elements...', {
        amount: total,
        paymentIntentId: orderResult.data.paymentIntentId,
      });

      // 2. Create Payment Method using Stripe Elements
      const cardNumberElement = elements.getElement(CardNumberElement);
      const cardExpiryElement = elements.getElement(CardExpiryElement);
      const cardCvcElement = elements.getElement(CardCvcElement);

      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        throw new Error('Card elements not found');
      }

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
        billing_details: {
          name: nameOnCard,
          email: email || undefined,
          phone: phoneNumber || undefined,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // 3. Confirm payment with Payment Method
      const confirmResult = await confirmPayment({
        paymentIntentId: orderResult.data.paymentIntentId,
        paymentMethodId: paymentMethod.id,
      });

      if (!confirmResult.ok) {
        throw new Error('Payment confirmation failed');
      }

      // 4. Mark payment as completed and redirect to success
      paymentDetails.status = 'completed';
      paymentDetails.orderId = orderResult.data.order.id;
      paymentDetails.paymentId = confirmResult.data.payment.id;
      paymentDetails.email = email;
      paymentDetails.phoneNumber = phoneNumber;
      localStorage.setItem(`payment-details-${restaurantGuid}`, JSON.stringify(paymentDetails));
      
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
      const paymentDetailsStr = localStorage.getItem(`payment-details-${restaurantGuid}`);
      if (paymentDetailsStr) {
        const paymentDetails = JSON.parse(paymentDetailsStr);
        paymentDetails.status = 'pending';
        localStorage.setItem(`payment-details-${restaurantGuid}`, JSON.stringify(paymentDetails));
      }
      
      setError(err instanceof Error ? err.message : 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!slug) return;
    router.push(
      hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/payment`),
    );
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Menu</h1>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 bg-[#f2f2f2] p-4">
        {/* Payment Options */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Payment Options
        </h2>
        <div className="bg-white px-4 py-6 mb-2">
          <div className="space-y-3">
            <div className="text-[14px] text-gray-900 mb-3">
              How would you like to pay by card?
            </div>

            <div className="flex flex-col gap-5 pl-2">
              {/* Enter card details manually */}
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="manual"
                  name="paymentMethod"
                  value="manual"
                  defaultChecked
                  className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                />
                <label htmlFor="manual" className="text-base font-medium text-gray-900">
                  Enter card details manually
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Pay Now Section */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">
          Pay now with card
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
          Card Details
        </h2>
        <div className="bg-white px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Room Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="roomNumber" className="text-sm font-medium text-gray-700">
                  Room Number
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                id="roomNumber"
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
                <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                id="fullName"
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
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="email"
                id="email"
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
                <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10 select-none text-gray-500 text-sm">
                  +1
                </div>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  className={cn(
                    "w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900",
                    errors.phoneNumber && "border-red-500 focus:ring-red-500 focus:border-red-500"
                  )}
                  placeholder="Enter phone number"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </div>
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.phoneNumber}</p>
              )}
            </div>

            {/* Name on Card */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="nameOnCard" className="text-sm font-medium text-gray-700">
                  Name on Card
                </label>
                <span className="text-xs text-red-500">Required</span>
              </div>
              <input
                type="text"
                id="nameOnCard"
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

            {/* Card Number */}
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

            {/* Expiry and CVC */}
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

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit Button */}
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
          </form>
        </div>

        <div className="mt-3 text-xs text-gray-500 text-center">
          Meet Simon&apos;s privacy policy & SMS policy regarding Internet
          information |{" "}
          <a href="#" className="text-blue-600 underline">
            Your Privacy Choices
          </a>
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
