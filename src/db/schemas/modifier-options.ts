import { bigserial, pgTable, uuid, bigint, text, jsonb, decimal, integer, boolean, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { modifierGroups } from "./modifier-groups";
import { menuStatusEnum } from "./menus";
import { relations } from "drizzle-orm";

export const modifierOptions = pgTable("modifier_options", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  modifierOptionGuid: uuid("modifier_option_guid").notNull(),
  modifierGroupId: bigint("modifier_group_id", { mode: "number" }).notNull().references(() => modifierGroups.id),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  calories: integer("calories"),
  isDefault: boolean("is_default"),
  isAvailable: boolean("is_available").notNull().default(true),
  modifierGroupReferences: integer("modifier_group_references").array().$type<number[]>(),
  status: menuStatusEnum("status").default("pending").notNull(),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("modifier_options_modifier_group_id_index").on(table.modifierGroupId),
  index("modifier_options_modifier_option_guid_index").on(table.modifierOptionGuid),
  index("modifier_options_is_available_index").on(table.isAvailable),
  index("modifier_options_status_index").on(table.status)
]); 

export const modifierOptionsRelations = relations(modifierOptions, ({ one }) => ({
  modifierGroup: one(modifierGroups, {
    fields: [modifierOptions.modifierGroupId],
    references: [modifierGroups.id],
  }),
}));

export type ModifierOption = typeof modifierOptions.$inferSelect;
export type NewModifierOption = typeof modifierOptions.$inferInsert;