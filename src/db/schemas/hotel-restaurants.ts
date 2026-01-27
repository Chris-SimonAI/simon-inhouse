import { pgTable, bigserial, bigint, decimal, boolean, index, unique } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { hotels } from "./hotels";
import { dineInRestaurants } from "./dine-in-restaurants";
import { relations } from "drizzle-orm";

/**
 * Junction table linking hotels to restaurants from the library.
 * Allows the same restaurant to be available at multiple hotels.
 */
export const hotelRestaurants = pgTable("hotel_restaurants", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull().references(() => hotels.id, { onDelete: "cascade" }),
  restaurantId: bigint("restaurant_id", { mode: "number" }).notNull().references(() => dineInRestaurants.id, { onDelete: "cascade" }),

  // Hotel-specific overrides
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }),
  serviceFeePercent: decimal("service_fee_percent", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),

  // Calculated distance from hotel to restaurant (in miles)
  distanceMiles: decimal("distance_miles", { precision: 10, scale: 2 }),

  ...timestamps,
}, (table) => [
  index("hotel_restaurants_hotel_id_index").on(table.hotelId),
  index("hotel_restaurants_restaurant_id_index").on(table.restaurantId),
  unique("hotel_restaurants_unique").on(table.hotelId, table.restaurantId),
]);

export const hotelRestaurantsRelations = relations(hotelRestaurants, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelRestaurants.hotelId],
    references: [hotels.id],
  }),
  restaurant: one(dineInRestaurants, {
    fields: [hotelRestaurants.restaurantId],
    references: [dineInRestaurants.id],
  }),
}));

export type HotelRestaurant = typeof hotelRestaurants.$inferSelect;
export type NewHotelRestaurant = typeof hotelRestaurants.$inferInsert;
