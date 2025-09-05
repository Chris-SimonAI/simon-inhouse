import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { hotels } from "@/db/schemas/hotels";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Hotel name is required").max(255, "Hotel name too long");

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
  latitude: latitudeValidation,
  longitude: longitudeValidation,
});

export const updateHotelSchema = createUpdateSchema(hotels, {
  name: (schema) => nameValidation(schema),
  latitude: (schema) => latitudeValidation(schema).optional(),
  longitude: (schema) => longitudeValidation(schema).optional(),
});

export const selectHotelSchema = createSelectSchema(hotels);

// Type exports
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type SelectHotel = z.infer<typeof selectHotelSchema>;
export type UpdateHotel = z.infer<typeof updateHotelSchema>;

