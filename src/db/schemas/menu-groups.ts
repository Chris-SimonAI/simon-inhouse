import { bigserial, pgTable, bigint, text, uuid, jsonb, index, integer, pgEnum } from "drizzle-orm/pg-core";
import { menus, menuStatusEnum } from "@/db/schemas/menus";
import { timestamps } from "../columns.helpers";
import { relations } from "drizzle-orm";

export const menuGroups = pgTable("menu_groups", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  menuGroupGuid: uuid("menu_group_guid").notNull(),
  menuId: bigint("menu_id", { mode: "number" }).notNull().references(() => menus.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  sortOrder: integer("sort_order").default(0),
  status: menuStatusEnum("status").default("pending").notNull(),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("menu_groups_menu_id_index").on(table.menuId),
  index("menu_groups_menu_group_guid_index").on(table.menuGroupGuid),
  index("menu_groups_status_index").on(table.status)
]);

export const menuGroupsRelations = relations(menuGroups, ({ one }) => ({
  menu: one(menus, {
    fields: [menuGroups.menuId],
    references: [menus.id],
  }),
}));


export type MenuGroup = typeof menuGroups.$inferSelect;
export type NewMenuGroup = typeof menuGroups.$inferInsert;