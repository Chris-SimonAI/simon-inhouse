import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { menus } from "@/db/schemas/menus";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Menu name is required").max(255, "Menu name too long");    

export const insertMenuSchema = createInsertSchema(menus, {
  name: nameValidation,
});

export const updateMenuSchema = createUpdateSchema(menus, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectMenuSchema = createSelectSchema(menus);

export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type SelectMenu = z.infer<typeof selectMenuSchema>; 
export type UpdateMenu = z.infer<typeof updateMenuSchema>;