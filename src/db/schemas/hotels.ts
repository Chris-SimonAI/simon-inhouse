import { pgTable, uuid, varchar, text, decimal, jsonb } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";

export const hotels = pgTable("hotels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 15, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 15, scale: 8 }).notNull(),
  metadata: jsonb("metadata"),
  ...timestamps,
});

// Export types for use in other parts of the application
export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
