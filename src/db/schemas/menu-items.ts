import { bigserial, pgTable, bigint, text, uuid, integer, decimal, index, boolean } from "drizzle-orm/pg-core";
import { jsonb } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { menuGroups } from "./menu-groups";
import { menuStatusEnum } from "./menus";
import { relations } from "drizzle-orm";

export const menuItems = pgTable("menu_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  menuGroupId: bigint("menu_group_id", { mode: "number" }).notNull().references(() => menuGroups.id),
  menuItemGuid: uuid("menu_item_guid").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  calories: integer("calories"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  allergens: text("allergens").array().$type<string[]>(),
  modifierGroupsReferences: integer("modifier_groups_references").array().$type<number[]>(),
  sortOrder: integer("sort_order"),
  isAvailable: boolean("is_available").notNull().default(true),
  status: menuStatusEnum("status").default("pending").notNull(),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("menu_items_menu_group_id_index").on(table.menuGroupId),
  index("menu_items_menu_item_guid_index").on(table.menuItemGuid),
  index("menu_items_is_available_index").on(table.isAvailable),
  index("menu_items_status_index").on(table.status)
]);

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  menuGroup: one(menuGroups, {
    fields: [menuItems.menuGroupId],
    references: [menuGroups.id],
  }),
}));

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;