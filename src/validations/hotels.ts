import { z } from "zod";

export const HotelSchema = z.object({
  name: z.string().min(1, "Hotel name is required").max(255, "Hotel name too long"),
  address: z.string().optional(),
  latitude: z.number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .multipleOf(0.00000001), // 8 decimal places precision
  longitude: z.number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .multipleOf(0.00000001), // 8 decimal places precision
  metadata: z.any().optional(), // Completely flexible - any valid JSON data
});


export const HotelInsertSchema = HotelSchema;
export const HotelSelectSchema = HotelSchema;
export const HotelUpdateSchema = HotelSchema.partial();

export type HotelInput = z.infer<typeof HotelInsertSchema>;
export type HotelUpdate = z.infer<typeof HotelUpdateSchema>;
export type HotelSelect = z.infer<typeof HotelSelectSchema>;
