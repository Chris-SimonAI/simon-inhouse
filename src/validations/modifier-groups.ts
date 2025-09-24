import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { modifierGroups } from "@/db/schemas/modifier-groups";

const nameValidation = (schema: z.ZodString) =>
 schema.min(1, "Modifier group name is required").max(255, "Modifier group name too long");

export const insertModifierGroupSchema = createInsertSchema(modifierGroups, {
  name: nameValidation,
});

export const updateModifierGroupSchema = createUpdateSchema(modifierGroups, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectModifierGroupSchema = createSelectSchema(modifierGroups);

export type InsertModifierGroup = z.infer<typeof insertModifierGroupSchema>;
export type SelectModifierGroup = z.infer<typeof selectModifierGroupSchema>; 
export type UpdateModifierGroup = z.infer<typeof updateModifierGroupSchema>;