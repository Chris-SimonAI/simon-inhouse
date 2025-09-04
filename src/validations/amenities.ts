import { z } from "zod";

export const AmenitiesSchema = z.object({
  hotelId: z.uuid(),
  roomTypes: z.array(z.any()),
  diningOptions: z.array(z.any()),
  poolOptions: z.array(z.any()).optional(),
  spaServices: z.array(z.any()).optional(),
  fitnessCenters: z.array(z.any()).optional(),
  businessCenters: z.array(z.any()).optional(),
  meetingSpaces: z.array(z.any()).optional(),
  accessibilityFeatures: z.array(z.any()).optional(),
  entertainment: z.array(z.any()).optional(),
  kidsFacilities: z.array(z.any()).optional(),
  outdoorActivities: z.array(z.any()).optional(),
  transportServices: z.array(z.any()).optional(),
  retailShops: z.array(z.any()).optional(),
  laundryServices: z.array(z.any()).optional(),
  conciergeServices: z.array(z.any()).optional(),
  roomServices: z.array(z.any()).optional(),
});

export const AmenitiesInsertSchema = AmenitiesSchema;
export const AmenitiesUpdateSchema = AmenitiesSchema.partial();
export const AmenitiesSelectSchema = AmenitiesSchema;

export type AmenitiesInput = z.infer<typeof AmenitiesInsertSchema>;
export type AmenitiesUpdate = z.infer<typeof AmenitiesUpdateSchema>;
export type AmenitiesSelect = z.infer<typeof AmenitiesSelectSchema>;