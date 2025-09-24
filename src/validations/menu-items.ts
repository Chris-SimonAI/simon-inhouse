import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { menuItems } from "@/db/schemas/menu-items";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Menu item name is required").max(255, "Menu item name too long");

export const insertMenuItemSchema = createInsertSchema(menuItems, {
  name: nameValidation,
});

export const updateMenuItemSchema = createUpdateSchema(menuItems, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectMenuItemSchema = createSelectSchema(menuItems);

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type SelectMenuItem = z.infer<typeof selectMenuItemSchema>; 
export type UpdateMenuItem = z.infer<typeof updateMenuItemSchema>;