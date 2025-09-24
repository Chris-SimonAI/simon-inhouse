import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { dineInRestaurants } from "@/db/schemas/dine-in-restaurants";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Restaurant name is required").max(255, "Restaurant name too long");

export const insertDineInRestaurantSchema = createInsertSchema(dineInRestaurants, {
  name: nameValidation,
});

export const updateDineInRestaurantSchema = createUpdateSchema(dineInRestaurants, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectDineInRestaurantSchema = createSelectSchema(dineInRestaurants);

export type InsertDineInRestaurant = z.infer<typeof insertDineInRestaurantSchema>;
export type SelectDineInRestaurant = z.infer<typeof selectDineInRestaurantSchema>; 
export type UpdateDineInRestaurant = z.infer<typeof updateDineInRestaurantSchema>;