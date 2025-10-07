import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY!;
