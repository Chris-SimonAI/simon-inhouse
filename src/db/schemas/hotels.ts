import { pgTable, bigserial, varchar, text, decimal, jsonb } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";

export const hotels = pgTable("hotels", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 15, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 15, scale: 8 }).notNull(),
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  metadata: jsonb("metadata"),
  ...timestamps,
});

export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
