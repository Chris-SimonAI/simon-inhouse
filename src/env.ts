import "server-only";

import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  BASE_URL: z.url(),
  GOOGLE_API_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
});

export const env = Env.parse(process.env);
