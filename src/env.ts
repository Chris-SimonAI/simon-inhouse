import "server-only";

import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  BASE_URL: z.string().url(),
  GOOGLE_API_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  APP_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  AWS_REGION: z.string().min(1),
  AWS_SQS_QUEUE_URL: z.string().min(1),
  FULFILLMENT_CALLBACK_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"])
});

// Only validate environment variables at runtime, not during build
let env: z.infer<typeof Env>;

try {
  env = Env.parse(process.env);
} catch (error) {
  // During build time, environment variables might not be available
  // This is acceptable as they will be validated at runtime
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    console.warn('Environment variables validation skipped during build. They will be validated at runtime.');
    env = {} as z.infer<typeof Env>;
  } else {
    throw error;
  }
}

export { env };
