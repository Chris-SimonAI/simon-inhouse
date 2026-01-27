import "server-only";

import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  BASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]),
  // Optional - needed for specific features
  GOOGLE_API_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  APP_API_KEY: z.string().min(1).optional(),
  POSTHOG_KEY: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  AWS_SQS_QUEUE_URL: z.string().min(1).optional(),
  AWS_SQS_SCRAPER_QUEUE_URL: z.string().min(1).optional(),
  FULFILLMENT_CALLBACK_SECRET: z.string().min(1).optional(),
});

// Neon Vercel integration uses POSTGRES_URL; normalize to DATABASE_URL
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}

// Only validate environment variables at runtime, not during build
let env: z.infer<typeof Env>;

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

try {
  env = Env.parse(process.env);
} catch (error) {
  if (isBuildPhase) {
    console.warn('Environment variables validation skipped during build. They will be validated at runtime.');
    env = {} as z.infer<typeof Env>;
  } else {
    throw error;
  }
}

export { env };
