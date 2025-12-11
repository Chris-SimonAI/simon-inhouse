import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { hotels } from "@/db/schemas/hotels";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Hotel name is required").max(255, "Hotel name too long");

const slugValidation = (schema: z.ZodString) =>
  schema
    .min(1, "Hotel slug is required")
    .max(64, "Hotel slug too long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Hotel slug must be lowercase alphanumeric and hyphenated");

const latitudeValidation = (schema: z.ZodString) =>
  schema
    .refine((val) => !isNaN(Number(val)), "Latitude must be a number")
    .refine(
      (val) => Number(val) >= -90 && Number(val) <= 90,
      "Latitude must be between -90 and 90"
    );

const longitudeValidation = (schema: z.ZodString) =>
  schema
    .refine((val) => !isNaN(Number(val)), "Longitude must be a number")
    .refine(
      (val) => Number(val) >= -180 && Number(val) <= 180,
      "Longitude must be between -180 and 180"
    );

export const insertHotelSchema = createInsertSchema(hotels, {
  name: nameValidation,
  slug: slugValidation,
  latitude: latitudeValidation,
  longitude: longitudeValidation,
  address: (schema) => schema.optional(),
  stripeAccountId: (schema) => schema.optional(),
  restaurantDiscount: (schema) =>
    (schema as unknown as z.ZodNumber).refine(
      (n) => n >= 0 && n <= 100,
      "Restaurant discount must be between 0 and 100"
    ).optional(),
  metadata: () => z.unknown().optional(),
});

export const updateHotelSchema = createUpdateSchema(hotels, {
  name: (schema) => nameValidation(schema),
  slug: (schema) => slugValidation(schema).optional(),
  latitude: (schema) => latitudeValidation(schema).optional(),
  longitude: (schema) => longitudeValidation(schema).optional(),
  address: (schema) => schema.optional(),
  stripeAccountId: (schema) => schema.optional(),
  // restaurantDiscount is a number (real) - allow 0..100
  restaurantDiscount: (schema) =>
    (schema as unknown as z.ZodNumber).refine(
      (n) => n >= 0 && n <= 100,
      "Restaurant discount must be between 0 and 100"
    ).optional(),
  metadata: () => z.unknown().optional(),
});

export const selectHotelSchema = createSelectSchema(hotels);

// Type exports
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type SelectHotel = z.infer<typeof selectHotelSchema>;
export type UpdateHotel = z.infer<typeof updateHotelSchema>;

