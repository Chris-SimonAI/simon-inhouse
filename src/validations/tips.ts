import { z } from 'zod';
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { tips } from "@/db/schemas";

// Tips validation schemas
export const TipSelectSchema = createSelectSchema(tips);
export const TipInsertSchema = createInsertSchema(tips);

// API request/response schemas
export const CreateTipRequestSchema = z.object({
  hotelId: z.number().positive('Hotel ID is required'),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().default('USD'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional().or(z.literal('')),
  roomNumber: z.string().optional(),
  message: z.string().optional(),
});

export const UpdateTipStatusSchema = z.object({
  tipId: z.number(),
  status: z.enum(['pending', 'completed', 'failed']),
  transactionId: z.string().optional(),
});

export type CreateTipRequest = z.infer<typeof CreateTipRequestSchema>;
export type UpdateTipStatusRequest = z.infer<typeof UpdateTipStatusSchema>;

// Database types
export type TipSelect = z.infer<typeof TipSelectSchema>;
export type TipInsert = z.infer<typeof TipInsertSchema>;
