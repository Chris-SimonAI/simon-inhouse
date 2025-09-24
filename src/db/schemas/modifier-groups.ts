import { pgTable, bigserial, bigint, uuid, text, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { menuItems } from "./menu-items";
import { relations } from "drizzle-orm";

export const modifierGroups = pgTable("modifier_groups", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  modifierGroupGuid: uuid("modifier_group_guid").notNull(),
  menuItemId: bigint("menu_item_id", { mode: "number" }).notNull().references(() => menuItems.id),
  name: text("name").notNull(),
  description: text("description"),
  minSelections: integer("min_selections"),
  maxSelections: integer("max_selections"),
  isRequired: boolean("is_required"),   
  isMultiSelect: boolean("is_multi_select"),
  modifierOptionsReferences: integer("modifier_options_references").array().$type<number[]>(),
  metadata: jsonb("metadata"),  
  ...timestamps,
}, (table) => [
  index("modifier_groups_menu_item_id_index").on(table.menuItemId),
  index("modifier_groups_modifier_group_guid_index").on(table.modifierGroupGuid)
]); 

export const modifierGroupsRelations = relations(modifierGroups, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [modifierGroups.menuItemId],
    references: [menuItems.id],
  }),
}));

export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type NewModifierGroup = typeof modifierGroups.$inferInsert;