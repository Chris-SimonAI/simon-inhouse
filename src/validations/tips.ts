import { z } from 'zod';
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { tips } from "@/db/schemas";
import { TIP_PAYMENT_STATUS } from "@/constants/payments";

// Tips validation schemas
export const TipSelectSchema = createSelectSchema(tips);
export const TipInsertSchema = createInsertSchema(tips);

// API request/response schemas
export const CreateTipRequestSchema = z.object({
  hotelId: z.number().positive('Hotel ID is required'),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().default('USD'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  // Guest information - currently not collected in UI
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional().or(z.literal('')),
  roomNumber: z.string().optional(),
  message: z.string().optional(),
});

export const UpdateTipStatusSchema = z.object({
  tipId: z.number(),
  status: z.enum([
    TIP_PAYMENT_STATUS.pending,
    TIP_PAYMENT_STATUS.completed,
    TIP_PAYMENT_STATUS.failed,
  ] as const),
  transactionId: z.string().optional(),
});

export type CreateTipRequest = z.infer<typeof CreateTipRequestSchema>;
export type UpdateTipStatusRequest = z.infer<typeof UpdateTipStatusSchema>;

// Database types
export type TipSelect = z.infer<typeof TipSelectSchema>;
export type TipInsert = z.infer<typeof TipInsertSchema>;
