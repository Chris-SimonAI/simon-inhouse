import { relations } from "drizzle-orm";
import { hotels } from "./hotels";
import { pgTable, bigserial, bigint, varchar, text, jsonb, decimal } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";

export const tips = pgTable("tips", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull().references(() => hotels.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // "credit_card"
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"), // "pending", "completed", "failed"
  transactionId: varchar("transaction_id", { length: 255 }),
  // Guest information - currently optional, not collected in UI
  // TODO: Add guest information collection in tip flow if needed
  guestName: varchar("guest_name", { length: 255 }),
  guestEmail: varchar("guest_email", { length: 255 }),
  roomNumber: varchar("room_number", { length: 20 }),
  message: text("message"), // Optional message from guest
  metadata: jsonb("metadata"), // Additional tip information
  ...timestamps,
});

// Relations
export const tipsRelations = relations(tips, ({ one }) => ({
  hotel: one(hotels, {
    fields: [tips.hotelId],
    references: [hotels.id],
  }),
}));

export type Tip = typeof tips.$inferSelect;
export type NewTip = typeof tips.$inferInsert;
