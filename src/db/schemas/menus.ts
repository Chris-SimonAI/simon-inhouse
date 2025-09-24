import { pgTable, text, uuid, bigint, bigserial, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { dineInRestaurants } from "./dine-in-restaurants";
import { relations } from "drizzle-orm";


export const menus = pgTable("menus", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  restaurantId: bigint("restaurant_id", { mode: "number" }).notNull().references(() => dineInRestaurants.id),
  menuGuid: uuid("menu_guid").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  lastUpdated: timestamp("last_updated", { withTimezone: true }),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("menus_restaurant_id_index").on(table.restaurantId),
  index("menus_menu_guid_index").on(table.menuGuid)
]);

export const menusRelations = relations(menus, ({ one }) => ({
  restaurant: one(dineInRestaurants, {
    fields: [menus.restaurantId],
    references: [dineInRestaurants.id],
  }),
}));

export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;