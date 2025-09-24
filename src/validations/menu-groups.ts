import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { menuGroups } from "@/db/schemas/menu-groups";

const nameValidation = (schema: z.ZodString) =>
    schema.min(1, "Menu group name is required").max(255, "Menu group name too long");

export const insertMenuGroupSchema = createInsertSchema(menuGroups, {
  name: nameValidation,
});

export const updateMenuGroupSchema = createUpdateSchema(menuGroups, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectMenuGroupSchema = createSelectSchema(menuGroups);

export type InsertMenuGroup = z.infer<typeof insertMenuGroupSchema>;
export type SelectMenuGroup = z.infer<typeof selectMenuGroupSchema>; 
export type UpdateMenuGroup = z.infer<typeof updateMenuGroupSchema>;