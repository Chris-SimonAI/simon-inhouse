import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { amenities } from "@/db/schemas/amenities";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Amenity name is required").max(255, "Amenity name too long");

export const insertAmenitySchema = createInsertSchema(amenities, {
  name: nameValidation,
});

export const updateAmenitySchema = createUpdateSchema(amenities, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectAmenitySchema = createSelectSchema(amenities);

export type InsertAmenity = z.infer<typeof insertAmenitySchema>;
export type SelectAmenity = z.infer<typeof selectAmenitySchema>;
export type UpdateAmenity = z.infer<typeof updateAmenitySchema>;