import type { TipOption } from "@/validations/dine-in-orders";

export type PaymentMethod = "card" | "applePay";

export type TipSelection = 18 | 20 | 25 | 0 | "custom";

export type TotalsInput = {
  cart: Array<{ totalPrice: number }>;
  discountPercentage: number;
  serviceFeePercent: number;
  deliveryFee: number;
  tipSelection: TipSelection;
  customTipAmount: number;
};

export type TotalsResult = {
  subtotal: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  serviceFee: number;
  deliveryFee: number;
  tipAmount: number;
  total: number;
  amountCents: number;
};

const MIN_CHARGE_CENTS = 50;

export function calculateSubtotal(cart: TotalsInput["cart"]): number {
  return cart.reduce((total, item) => total + (item.totalPrice || 0), 0);
}

export function calculateTipAmount(
  subtotal: number,
  tipSelection: TipSelection,
  customTipAmount: number,
): number {
  if (tipSelection === "custom") {
    return Math.max(0, customTipAmount);
  }
  if (tipSelection === 0) {
    return 0;
  }
  return subtotal * (tipSelection / 100);
}

export function buildTipOption(
  tipSelection: TipSelection,
  customTipAmount: number,
): TipOption {
  return tipSelection === "custom"
    ? { type: "fixed", value: Math.max(0, customTipAmount) }
    : { type: "percentage", value: tipSelection };
}

export function calculateTotals({
  cart,
  discountPercentage,
  serviceFeePercent,
  deliveryFee,
  tipSelection,
  customTipAmount,
}: TotalsInput): TotalsResult {
  const subtotal = calculateSubtotal(cart);
  const discountAmount =
    discountPercentage > 0 ? (subtotal * discountPercentage) / 100 : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const serviceFee = serviceFeePercent > 0 ? (subtotal * serviceFeePercent) / 100 : 0;
  const tipAmount = calculateTipAmount(subtotal, tipSelection, customTipAmount);
  const total = subtotalAfterDiscount + serviceFee + deliveryFee + tipAmount;
  const amountCents = Math.max(MIN_CHARGE_CENTS, Math.round(total * 100));

  return {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    serviceFee,
    deliveryFee,
    tipAmount,
    total,
    amountCents,
  };
}
