import type { TipOption } from "@/validations/dine-in-orders";
import type { PaymentMethod, TipSelection } from "./totals";

export type StoredMenuItem = {
  id: string;
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

export type StoredCartItem = {
  id: string;
  totalPrice: number;
  quantity: number;
  selectedModifiers: Record<string, string[]>;
  menuItem: StoredMenuItem;
};

export type StoredPaymentDetails = {
  sessionId: string;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  discount: number;
  discountPercentage: number;
  subtotalAfterDiscount: number;
  tip: number;
  tipOption: TipOption;
  total: number;
  cart: StoredCartItem[];
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  paymentMethod: PaymentMethod;
  canUseApplePay?: boolean;
  orderId?: string | number;
  paymentId?: string | number;
  email?: string;
  phoneNumber?: string;
};

const cartKey = (restaurantGuid: string) => `cart-${restaurantGuid}`;
const tipKey = (restaurantGuid: string) => `tip-selection-${restaurantGuid}`;
const paymentMethodKey = (restaurantGuid: string) =>
  `payment-method-${restaurantGuid}`;
const paymentDetailsKey = (restaurantGuid: string) =>
  `payment-details-${restaurantGuid}`;
const paymentSessionKey = (restaurantGuid: string) =>
  `payment-session-${restaurantGuid}`;

export function loadCartFromStorage(restaurantGuid: string): StoredCartItem[] {
  const savedCart = localStorage.getItem(cartKey(restaurantGuid));
  if (!savedCart) return [];

  try {
    const parsed = JSON.parse(savedCart);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error("Error parsing cart:", error);
  }

  localStorage.removeItem(cartKey(restaurantGuid));
  return [];
}

export function saveCartToStorage(
  restaurantGuid: string,
  cart: StoredCartItem[],
): void {
  localStorage.setItem(cartKey(restaurantGuid), JSON.stringify(cart));
}

export function loadTipSelection(restaurantGuid: string): TipSelection | null {
  const savedTipSelection = localStorage.getItem(tipKey(restaurantGuid));
  if (!savedTipSelection) return null;

  try {
    const tipData = JSON.parse(savedTipSelection);
    if (tipData.selectedTip !== undefined) {
      return tipData.selectedTip as TipSelection;
    }
  } catch (error) {
    console.error("Error loading tip selection:", error);
  }
  return null;
}

export function saveTipSelection(
  restaurantGuid: string,
  tipSelection: TipSelection,
): void {
  localStorage.setItem(
    tipKey(restaurantGuid),
    JSON.stringify({ selectedTip: tipSelection }),
  );
}

export function clearTipSelection(restaurantGuid: string): void {
  localStorage.removeItem(tipKey(restaurantGuid));
}

export function loadPaymentMethod(
  restaurantGuid: string,
): PaymentMethod | null {
  const savedPaymentMethod = localStorage.getItem(paymentMethodKey(restaurantGuid));
  if (savedPaymentMethod === "card" || savedPaymentMethod === "applePay") {
    return savedPaymentMethod;
  }
  return null;
}

export function savePaymentMethod(
  restaurantGuid: string,
  method: PaymentMethod,
): void {
  localStorage.setItem(paymentMethodKey(restaurantGuid), method);
}

export function savePaymentSessionId(
  restaurantGuid: string,
  sessionId: string,
): void {
  localStorage.setItem(paymentSessionKey(restaurantGuid), sessionId);
}

export function savePaymentDetails(
  restaurantGuid: string,
  details: StoredPaymentDetails,
): void {
  localStorage.setItem(paymentDetailsKey(restaurantGuid), JSON.stringify(details));
}

export function loadPaymentDetails(
  restaurantGuid: string,
): StoredPaymentDetails | null {
  const paymentDetailsStr = localStorage.getItem(paymentDetailsKey(restaurantGuid));
  if (!paymentDetailsStr) return null;
  try {
    return JSON.parse(paymentDetailsStr) as StoredPaymentDetails;
  } catch (error) {
    console.error("Error parsing payment details:", error);
    return null;
  }
}

export function markPaymentAsProcessing(
  restaurantGuid: string,
  {
    maxAgeMs = 5 * 60 * 1000,
    maxAttempts = 3,
  }: { maxAgeMs?: number; maxAttempts?: number } = {},
): StoredPaymentDetails {
  const paymentDetails = loadPaymentDetails(restaurantGuid);
  if (!paymentDetails) {
    throw new Error("Payment session not found. Please start over.");
  }

  if (paymentDetails.status === "completed") {
    throw new Error("Payment already completed.");
  }

  if (paymentDetails.status === "processing") {
    throw new Error("Payment is already being processed. Please wait.");
  }

  const sessionAge = Date.now() - paymentDetails.timestamp;
  if (sessionAge > maxAgeMs) {
    throw new Error("Payment session expired. Please start over.");
  }

  if (paymentDetails.attempts >= maxAttempts) {
    throw new Error("Maximum payment attempts exceeded. Please start over.");
  }

  const updated: StoredPaymentDetails = {
    ...paymentDetails,
    status: "processing",
    attempts: (paymentDetails.attempts || 0) + 1,
  };

  savePaymentDetails(restaurantGuid, updated);
  return updated;
}

export function resetPaymentStatusToPending(restaurantGuid: string): void {
  const paymentDetails = loadPaymentDetails(restaurantGuid);
  if (!paymentDetails) return;
  const updated = { ...paymentDetails, status: "pending" } satisfies StoredPaymentDetails;
  savePaymentDetails(restaurantGuid, updated);
}
