import { bigserial, pgTable, bigint, text, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { menus } from "@/db/schemas/menus";
import { timestamps } from "../columns.helpers";
import { relations } from "drizzle-orm";

export const menuGroups = pgTable("menu_groups", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  menuGroupGuid: uuid("menu_group_guid").notNull(),
  menuId: bigint("menu_id", { mode: "number" }).notNull().references(() => menus.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("menu_groups_menu_id_index").on(table.menuId),
  index("menu_groups_menu_group_guid_index").on(table.menuGroupGuid)
]);

export const menuGroupsRelations = relations(menuGroups, ({ one }) => ({
  menu: one(menus, {
    fields: [menuGroups.menuId],
    references: [menus.id],
  }),
}));


export type MenuGroup = typeof menuGroups.$inferSelect;
export type NewMenuGroup = typeof menuGroups.$inferInsert;