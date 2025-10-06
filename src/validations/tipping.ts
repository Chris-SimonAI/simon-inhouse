import { z } from 'zod';

export const InitiateTippingArgsSchema = z.object({
  hotelId: z.number().int().positive('Hotel ID must be a positive integer'),
  message: z.string().optional().describe('Optional custom message to display on the tipping page'),
});

export type InitiateTippingArgsInput = z.infer<typeof InitiateTippingArgsSchema>;
