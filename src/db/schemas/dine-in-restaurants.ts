import { pgTable, text, uuid, bigint, jsonb, decimal, bigserial, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { hotels } from "./hotels";
import { relations } from "drizzle-orm";

export const dineInRestaurants = pgTable("dine_in_restaurants", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull().references(() => hotels.id),
  restaurantGuid: uuid("restaurant_guid").notNull(),
  name: text("name").notNull(),
  description: text("description"),

  // these are not available in the toastAPI; added manually
  cuisine: text("cuisine"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  rating: decimal("rating", { precision: 10, scale: 2 }),

  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  phoneNumber: text("phone_number"),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("dine_in_restaurants_hotel_id_index").on(table.hotelId),
  index("dine_in_restaurants_restaurant_guid_index").on(table.restaurantGuid)
]);

export const dineInRestaurantsRelations = relations(dineInRestaurants, ({ one }) => ({
  hotel: one(hotels, {
    fields: [dineInRestaurants.hotelId],
    references: [hotels.id],
  }),
}));


export type DineInRestaurant = typeof dineInRestaurants.$inferSelect;
export type NewDineInRestaurant = typeof dineInRestaurants.$inferInsert;