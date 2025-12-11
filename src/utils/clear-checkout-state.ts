'use client';

export function clearCheckoutState(restaurantGuid: string) {
  try {
    const key = (name: string) => `${name}-${restaurantGuid}`;
    localStorage.removeItem(key('cart'));
    localStorage.removeItem(key('tip-selection'));
    localStorage.removeItem(key('payment-details'));
    localStorage.removeItem(key('payment-session'));
  } catch {
    // no-op
  }
}



