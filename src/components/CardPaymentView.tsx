"use client";

import { useState, useEffect } from "react";
import { CartItem } from "./MenuView";
import { Button } from "@/components/ui/button";
import { X, CreditCard, Lock, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { z } from "zod";

type CardPaymentViewProps = {
  restaurantGuid: string;
};

type PaymentOption = "manual" | "saved";

const cardPaymentSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  lastName: z.string().min(1, "Last name is required"),
  nameOnCard: z.string().min(1, "Name on card is required"),
  cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
  expirationDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Invalid expiration date (MM/YY)"),
  securityCode: z
    .string()
    .regex(/^\d{3,4}$/, "Security code must be 3-4 digits"),
});

type CardPaymentForm = z.infer<typeof cardPaymentSchema>;

export function CardPaymentView({ restaurantGuid }: CardPaymentViewProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("manual");
  const [paymentDetails, setPaymentDetails] = useState({
    subtotal: 0,
    tax: 0,
    tip: 0,
    total: 0,
  });

  // Form state
  const [roomNumber, setRoomNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof CardPaymentForm, string>>
  >({});

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${restaurantGuid}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Load payment details from localStorage
    const savedPaymentDetails = localStorage.getItem(
      `payment-details-${restaurantGuid}`
    );
    if (savedPaymentDetails) {
      setPaymentDetails(JSON.parse(savedPaymentDetails));
    }
  }, [restaurantGuid]);

  const getTotal = () => {
    return paymentDetails.total;
  };

  const handleClose = () => {
    router.push(`/dine-in/restaurant/${restaurantGuid}/payment`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData = {
      roomNumber,
      lastName,
      nameOnCard,
      cardNumber,
      expirationDate,
      securityCode,
    };

    const result = cardPaymentSchema.safeParse(formData);

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

    // TODO: Implement payment processing
    console.log("Processing card payment...", {
      ...result.data,
      total: getTotal(),
    });
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(" ") : cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, "");
    if (value.length <= 16 && /^\d*$/.test(value)) {
      setCardNumber(value);
      if (errors.cardNumber) {
        setErrors((prev) => ({ ...prev, cardNumber: undefined }));
      }
    }
  };

  const handleExpirationDateChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2, 4);
    }
    if (value.length <= 5) {
      setExpirationDate(value);
      if (errors.expirationDate) {
        setErrors((prev) => ({ ...prev, expirationDate: undefined }));
      }
    }
  };

  const handleSecurityCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 4 && /^\d*$/.test(value)) {
      setSecurityCode(value);
      if (errors.securityCode) {
        setErrors((prev) => ({ ...prev, securityCode: undefined }));
      }
    }
  };

  if (cart.length === 0 || paymentDetails.total === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
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

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-4">No items in your cart</p>
            <Button
              onClick={() =>
                router.push(`/dine-in/restaurant/${restaurantGuid}/menu`)
              }
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Go to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
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
        {/* Card Payment Options */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Card Payment Options
        </h2>
        <div className="bg-white px-4 py-6 mb-4">
          <div className="space-y-3">
            <div className="text-[14px] text-gray-900 mb-3">
              How would you like to pay by card?
            </div>

            <div className="flex flex-col gap-5 pl-2">
              {/* Enter card details manually */}
              <button
                onClick={() => setPaymentOption("manual")}
                className="w-full flex items-center justify-between rounded-lg transition-colors"
              >
                <span className="text-base font-medium text-gray-900">
                  Enter card details manually
                </span>
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    paymentOption === "manual"
                      ? "border-gray-900"
                      : "border-gray-300"
                  )}
                >
                  {paymentOption === "manual" && (
                    <div className="w-3 h-3 rounded-full bg-gray-900" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Pay now with card form */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Pay now with card
        </h2>
        <div className="bg-white px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Total */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-base font-semibold text-gray-900">
                Total
              </span>
              <span className="text-base font-semibold text-gray-900">
                {getTotal().toFixed(2)} USD
              </span>
            </div>

            {/* Privacy Notice */}
            <p className="text-sm text-gray-600 leading-relaxed">
              Please enter your details below. We will only use this information
              to contact you about your order and for no other purpose.
            </p>

            {/* Room Number */}
            <div>
              <label className="flex justify-between items-center mb-2">
                <span className="text-base font-medium text-gray-900">
                  Room Number
                </span>
                <span className="text-sm text-gray-500">Required</span>
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => {
                  setRoomNumber(e.target.value);
                  if (errors.roomNumber) {
                    setErrors((prev) => ({ ...prev, roomNumber: undefined }));
                  }
                }}
                className={cn(
                  "w-full px-4 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                  errors.roomNumber
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-gray-900"
                )}
              />
              {errors.roomNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.roomNumber}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="flex justify-between items-center mb-2">
                <span className="text-base font-medium text-gray-900">
                  Last Name
                </span>
                <span className="text-sm text-gray-500">Required</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) {
                    setErrors((prev) => ({ ...prev, lastName: undefined }));
                  }
                }}
                className={cn(
                  "w-full px-4 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                  errors.lastName
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-gray-900"
                )}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>

            {/* Name on Card */}
            <div>
              <label className="flex justify-between items-center mb-2">
                <span className="text-base font-medium text-gray-900">
                  Name on Card
                </span>
                <span className="text-sm text-gray-500">Required</span>
              </label>
              <input
                type="text"
                value={nameOnCard}
                onChange={(e) => {
                  setNameOnCard(e.target.value);
                  if (errors.nameOnCard) {
                    setErrors((prev) => ({ ...prev, nameOnCard: undefined }));
                  }
                }}
                className={cn(
                  "w-full px-4 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                  errors.nameOnCard
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-gray-900"
                )}
              />
              {errors.nameOnCard && (
                <p className="mt-1 text-sm text-red-600">{errors.nameOnCard}</p>
              )}
            </div>

            {/* Card Number */}
            <div>
              <label className="block mb-2">
                <span className="text-base font-medium text-gray-900">
                  Card Number
                </span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <CreditCard className="w-5 h-5 text-gray-900" />
                </div>
                <input
                  type="text"
                  value={formatCardNumber(cardNumber)}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  className={cn(
                    "w-full pl-12 pr-12 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                    errors.cardNumber
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-gray-900"
                  )}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Lock className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              {errors.cardNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>
              )}
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block mb-2">
                <span className="text-base font-medium text-gray-900">
                  Expiration Date
                </span>
              </label>
              <input
                type="text"
                value={expirationDate}
                onChange={handleExpirationDateChange}
                placeholder="MM/YY"
                className={cn(
                  "w-full px-4 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                  errors.expirationDate
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-gray-900"
                )}
              />
              {errors.expirationDate && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.expirationDate}
                </p>
              )}
            </div>

            {/* Security Code */}
            <div>
              <label className="block mb-2">
                <span className="text-base font-medium text-gray-900">
                  Security Code
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={securityCode}
                  onChange={handleSecurityCodeChange}
                  placeholder="CVV"
                  className={cn(
                    "w-full pr-20 px-4 py-3 border rounded-md text-base focus:outline-none focus:ring-2 focus:border-transparent",
                    errors.securityCode
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-gray-900"
                  )}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-500" />
                  <Lock className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              {errors.securityCode && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.securityCode}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-[2px] py-7 text-base font-semibold mt-6"
              size="lg"
            >
              Pay {getTotal().toFixed(2)} USD
            </Button>
          </form>
        </div>

        {/* Privacy Footer */}
        <div className="mt-4 text-xs text-gray-500 text-center px-4">
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
