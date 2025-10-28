import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Get Stripe client instance (lazy initialization to avoid build-time errors)
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
    });
  }
  return _stripe;
}

// For backward compatibility, export a getter
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  }
});

export const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY!
