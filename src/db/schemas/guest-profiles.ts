import { pgTable, bigserial, varchar, text, bigint, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { hotels } from "./hotels";

export const guestProfiles = pgTable("guest_profiles", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  roomNumber: varchar("room_number", { length: 10 }),
  dietaryPreferences: text("dietary_preferences").array().$type<string[]>().default([]),
  allergies: text("allergies").array().$type<string[]>().default([]),
  favoriteCuisines: text("favorite_cuisines").array().$type<string[]>().default([]),
  dislikedFoods: text("disliked_foods").array().$type<string[]>().default([]),
  notes: text("notes"),
  hotelId: bigint("hotel_id", { mode: "number" }).references(() => hotels.id),
  smsThreadId: text("sms_thread_id"),
  hasBeenIntroduced: boolean("has_been_introduced").notNull().default(false),
  lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
  metadata: jsonb("metadata").default("{}"),
  ...timestamps,
});

export type GuestProfile = typeof guestProfiles.$inferSelect;
export type NewGuestProfile = typeof guestProfiles.$inferInsert;
