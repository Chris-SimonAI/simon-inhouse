import { pgTable, bigserial, varchar, text, decimal, bigint, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { guestProfiles } from "./guest-profiles";

export const guestPreferences = pgTable("guest_preferences", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  guestId: bigint("guest_id", { mode: "number" })
    .notNull()
    .references(() => guestProfiles.id, { onDelete: "cascade" }),
  preferenceType: varchar("preference_type", { length: 50 }).notNull(), // 'allergy', 'cuisine_like', 'cuisine_dislike', 'spice_level', 'price_range', 'dietary'
  preferenceValue: text("preference_value").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull().default("1.0"), // 0.00 to 1.00
  source: varchar("source", { length: 20 }).notNull().default("stated"), // 'stated', 'inferred', 'order_history'
  ...timestamps,
}, (table) => [
  index("guest_preferences_guest_id_idx").on(table.guestId),
  index("guest_preferences_type_idx").on(table.preferenceType),
]);

export type GuestPreference = typeof guestPreferences.$inferSelect;
export type NewGuestPreference = typeof guestPreferences.$inferInsert;
