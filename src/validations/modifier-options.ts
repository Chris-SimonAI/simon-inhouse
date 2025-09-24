import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { modifierOptions } from "@/db/schemas/modifier-options";

const nameValidation = (schema: z.ZodString) =>
  schema.min(1, "Modifier option name is required").max(255, "Modifier option name too long");    

export const insertModifierOptionSchema = createInsertSchema(modifierOptions, {
  name: nameValidation,
});

export const updateModifierOptionSchema = createUpdateSchema(modifierOptions, {
  name: (schema) => nameValidation(schema).optional(),
});

export const selectModifierOptionSchema = createSelectSchema(modifierOptions);

export type InsertModifierOption = z.infer<typeof insertModifierOptionSchema>;
export type SelectModifierOption = z.infer<typeof selectModifierOptionSchema>; 
export type UpdateModifierOption = z.infer<typeof updateModifierOptionSchema>;